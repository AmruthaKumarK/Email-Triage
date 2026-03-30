"""
Deterministic agent graders for the OpenEnv Email Triage Environment.

Each grader scores agent performance on a specific task from 0.0 to 1.0.
Graders are stateless and deterministic given the same inputs.
"""
from __future__ import annotations
from typing import Dict, List, Optional
from .models import Email, EpisodeState


# Category weights for partial credit (how similar categories are)
CATEGORY_SIMILARITY = {
    ("sales", "newsletter"): 0.3,
    ("newsletter", "sales"): 0.3,
    ("support", "executive"): 0.2,
    ("executive", "support"): 0.2,
    ("spam", "newsletter"): 0.4,
    ("newsletter", "spam"): 0.4,
    ("legal", "executive"): 0.3,
    ("executive", "legal"): 0.3,
    ("hr", "executive"): 0.2,
    ("executive", "hr"): 0.2,
    ("personal", "newsletter"): 0.2,
    ("newsletter", "personal"): 0.2,
}

# Priority adjacency for partial credit
PRIORITY_ORDER = {"critical": 3, "high": 2, "medium": 1, "low": 0}


def category_score(predicted: str, actual: str) -> float:
    """Score a single category prediction (0.0 to 1.0)."""
    if predicted == actual:
        return 1.0
    return CATEGORY_SIMILARITY.get((predicted, actual), 0.0)


def priority_score(predicted: str, actual: str) -> float:
    """Score a single priority prediction (0.0 to 1.0)."""
    if predicted == actual:
        return 1.0
    pred_ord = PRIORITY_ORDER.get(predicted, 0)
    act_ord = PRIORITY_ORDER.get(actual, 0)
    diff = abs(pred_ord - act_ord)
    if diff == 0:
        return 1.0
    elif diff == 1:
        return 0.5
    elif diff == 2:
        return 0.2
    return 0.0


def reply_quality_score(reply_text: str, email: Email) -> float:
    """Score a reply draft on quality (0.0 to 1.0)."""
    if not reply_text or len(reply_text.strip()) < 10:
        return 0.0

    score = 0.0
    text_lower = reply_text.lower()

    # Length check: meaningful reply
    if len(reply_text) >= 50:
        score += 0.2
    if len(reply_text) >= 150:
        score += 0.1

    # Professional greeting/closing
    greetings = ["hi ", "hello", "dear ", "good morning", "good afternoon"]
    if any(g in text_lower for g in greetings):
        score += 0.1

    closings = ["regards", "sincerely", "best", "thank you", "thanks", "cheers"]
    if any(c in text_lower for c in closings):
        score += 0.1

    # Context-appropriate content based on category
    category_keywords = {
        "support": ["issue", "help", "resolve", "fix", "team", "look into", "investigate", "update"],
        "legal": ["document", "review", "counsel", "compliance", "confirm", "legal", "sign", "attach"],
        "executive": ["meeting", "agenda", "confirm", "attend", "discuss", "schedule", "board"],
        "sales": ["interested", "discuss", "call", "schedule", "pricing", "consider", "review"],
        "hr": ["confirm", "completed", "portal", "deadline", "enroll", "review"],
        "personal": ["sure", "sounds", "great", "works", "yes", "no", "unfortunately"],
    }

    if email.category in category_keywords:
        kws = category_keywords[email.category]
        matches = sum(1 for kw in kws if kw in text_lower)
        score += min(0.3, matches * 0.1)

    # Priority-appropriate urgency signals
    if email.priority == "critical":
        urgency_words = ["immediately", "urgent", "asap", "right away", "priority", "escalat"]
        if any(w in text_lower for w in urgency_words):
            score += 0.2
    elif email.priority in ("high", "medium"):
        if any(w in text_lower for w in ["soon", "promptly", "quickly", "follow up"]):
            score += 0.1

    return min(1.0, score)


class ClassificationGrader:
    """
    Grader for task_classify: Email Classification (Easy).

    Evaluates accuracy of category labels assigned to 10 emails.
    Provides partial credit for adjacent categories.
    """

    def grade_step(
        self,
        email: Email,
        predicted_category: str,
        state: EpisodeState,
    ) -> float:
        """Grade a single classification action. Returns reward (0.0-1.0)."""
        if email.category is None:
            return 0.0

        base_score = category_score(predicted_category, email.category)
        n_emails = len(state.emails)

        # Normalize: each email worth equal share, max 1.0 cumulative
        per_email_weight = 1.0 / n_emails if n_emails > 0 else 0.1

        # Penalty for already-processed email
        if email.is_processed:
            return -0.02 * per_email_weight

        reward = base_score * per_email_weight

        # Bonus for getting critical/spam exactly right (high stakes)
        if email.category in ("spam",) and base_score == 1.0:
            reward += 0.02 * per_email_weight
        if email.category in ("executive", "legal") and base_score == 1.0:
            reward += 0.01 * per_email_weight

        return reward

    def final_score(self, state: EpisodeState) -> float:
        """Calculate final score (0.0-1.0) from episode state."""
        emails = state.emails
        if not emails:
            return 0.0

        total = 0.0
        for email in emails:
            if email.id in state.classified and email.category:
                total += category_score(state.classified[email.id], email.category)

        return total / len(emails)


class PriorityRankingGrader:
    """
    Grader for task_prioritize: Priority Ranking (Medium).

    Evaluates both category accuracy and priority assignment.
    Uses weighted F1 scoring across both dimensions.
    """

    CATEGORY_WEIGHT = 0.5
    PRIORITY_WEIGHT = 0.5

    def grade_step(
        self,
        email: Email,
        predicted_category: Optional[str],
        predicted_priority: Optional[str],
        state: EpisodeState,
    ) -> float:
        """Grade a combined classify+prioritize action."""
        n_emails = len(state.emails)
        per_email_weight = 1.0 / n_emails if n_emails > 0 else 0.1

        cat_score = 0.0
        pri_score = 0.0

        if predicted_category and email.category:
            cat_score = category_score(predicted_category, email.category)

        if predicted_priority and email.priority:
            pri_score = priority_score(predicted_priority, email.priority)

        combined = (cat_score * self.CATEGORY_WEIGHT) + (pri_score * self.PRIORITY_WEIGHT)

        # Bonus: correct identification of critical emails
        if (
            email.priority == "critical"
            and predicted_priority == "critical"
            and predicted_category == email.category
        ):
            combined = min(1.0, combined + 0.15)

        reward = combined * per_email_weight

        # Penalty for missing a critical email
        if email.priority == "critical" and predicted_priority not in ("critical", "high"):
            reward -= 0.03 * per_email_weight

        return reward

    def final_score(self, state: EpisodeState) -> float:
        """Calculate final score."""
        emails = state.emails
        if not emails:
            return 0.0

        cat_total = 0.0
        pri_total = 0.0
        n = len(emails)

        for email in emails:
            if email.category and email.id in state.classified:
                cat_total += category_score(state.classified[email.id], email.category)
            if email.priority and email.id in state.prioritized:
                pri_total += priority_score(state.prioritized[email.id], email.priority)

        cat_score = cat_total / n
        pri_score = pri_total / n

        return (cat_score * self.CATEGORY_WEIGHT) + (pri_score * self.PRIORITY_WEIGHT)


class FullTriageGrader:
    """
    Grader for task_full_triage: Full Triage Pipeline (Hard).

    Evaluates a 5-component composite score:
    1. Classification accuracy (25%)
    2. Priority correctness (20%)
    3. Reply quality for emails requiring replies (25%)
    4. Escalation decisions (20%)
    5. Pipeline completeness (10%)
    """

    WEIGHTS = {
        "classification": 0.25,
        "priority": 0.20,
        "reply": 0.25,
        "escalation": 0.20,
        "completeness": 0.10,
    }

    def grade_classify_step(self, email: Email, predicted_category: str, state: EpisodeState) -> float:
        """Reward for classification action in full triage."""
        if not email.category:
            return 0.0
        base = category_score(predicted_category, email.category)
        per_email = self.WEIGHTS["classification"] / len(state.emails)
        return base * per_email

    def grade_priority_step(self, email: Email, predicted_priority: str, state: EpisodeState) -> float:
        """Reward for prioritization action in full triage."""
        if not email.priority:
            return 0.0
        base = priority_score(predicted_priority, email.priority)
        per_email = self.WEIGHTS["priority"] / len(state.emails)
        # Critical miss penalty
        if email.priority == "critical" and predicted_priority not in ("critical", "high"):
            base -= 0.5
        return max(0.0, base * per_email)

    def grade_reply_step(self, email: Email, reply_text: str, state: EpisodeState) -> float:
        """Reward for reply drafting action."""
        if not email.requires_reply:
            # Penalize replying to emails that don't need replies (spam, newsletters)
            if email.category in ("spam", "newsletter"):
                return -0.02
            return 0.0

        quality = reply_quality_score(reply_text, email)
        reply_emails = [e for e in state.emails if e.requires_reply]
        if not reply_emails:
            return 0.0
        per_email = self.WEIGHTS["reply"] / len(reply_emails)
        return quality * per_email

    def grade_escalation_step(self, email: Email, state: EpisodeState) -> float:
        """Reward for escalation action."""
        critical_emails = [e for e in state.emails if e.priority == "critical"]
        if not critical_emails:
            return 0.0

        if email.priority == "critical":
            per_critical = self.WEIGHTS["escalation"] / len(critical_emails)
            return per_critical  # Correct escalation
        else:
            return -0.05  # False escalation penalty

    def grade_archive_step(self, email: Email, state: EpisodeState) -> float:
        """Reward for archiving spam/newsletters."""
        if email.category in ("spam", "newsletter"):
            n_noise = len([e for e in state.emails if e.category in ("spam", "newsletter")])
            return 0.02 / max(1, n_noise)
        else:
            return -0.05  # Wrong email archived

    def final_score(self, state: EpisodeState) -> float:
        """Calculate 5-component composite final score."""
        emails = state.emails
        if not emails:
            return 0.0

        n = len(emails)

        # 1. Classification score
        cat_total = sum(
            category_score(state.classified.get(e.id, ""), e.category or "")
            for e in emails
        )
        classification_score = cat_total / n if n > 0 else 0.0

        # 2. Priority score
        pri_total = sum(
            priority_score(state.prioritized.get(e.id, ""), e.priority or "")
            for e in emails
        )
        priority_score_val = pri_total / n if n > 0 else 0.0

        # 3. Reply quality score
        reply_emails = [e for e in emails if e.requires_reply]
        if reply_emails:
            reply_total = sum(
                reply_quality_score(state.replied.get(e.id, ""), e)
                for e in reply_emails
            )
            reply_score = reply_total / len(reply_emails)
        else:
            reply_score = 1.0  # No replies needed = perfect

        # 4. Escalation score
        critical_emails = [e for e in emails if e.priority == "critical"]
        if critical_emails:
            correctly_escalated = sum(1 for e in critical_emails if e.id in state.escalated)
            false_escalations = sum(1 for eid in state.escalated if
                                   next((e for e in emails if e.id == eid), None) and
                                   next((e for e in emails if e.id == eid), None).priority != "critical")
            escalation_recall = correctly_escalated / len(critical_emails)
            escalation_precision = correctly_escalated / max(1, len(state.escalated)) if state.escalated else 1.0
            escalation_f1 = (
                2 * escalation_precision * escalation_recall / (escalation_precision + escalation_recall)
                if (escalation_precision + escalation_recall) > 0 else 0.0
            )
        else:
            escalation_f1 = 1.0

        # 5. Completeness score
        noise_emails = [e for e in emails if e.category in ("spam", "newsletter")]
        if noise_emails:
            correctly_archived = sum(1 for e in noise_emails if e.id in state.archived)
            completeness = correctly_archived / len(noise_emails)
        else:
            completeness = 1.0

        # Weighted composite
        score = (
            classification_score * self.WEIGHTS["classification"]
            + priority_score_val * self.WEIGHTS["priority"]
            + reply_score * self.WEIGHTS["reply"]
            + escalation_f1 * self.WEIGHTS["escalation"]
            + completeness * self.WEIGHTS["completeness"]
        )

        return min(1.0, max(0.0, score))
