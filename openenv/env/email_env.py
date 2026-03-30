"""
EmailTriageEnv: Full OpenEnv-compliant environment for Email Triage.

Implements the standard OpenEnv interface:
  - reset() -> Observation
  - step(action) -> (Observation, reward, done, info)
  - state() -> EpisodeState
"""
from __future__ import annotations
import uuid
from typing import Optional, Tuple, Dict, Any
from .models import (
    Observation, Action, EpisodeState, StepInfo, TaskInfo, Email
)
from .email_dataset import generate_email_dataset
from .graders import ClassificationGrader, PriorityRankingGrader, FullTriageGrader

TASKS = {
    "task_classify": {
        "name": "Email Classification",
        "description": (
            "Classify 10 emails into the correct category: sales, support, legal, hr, "
            "executive, spam, newsletter, or personal. Use the classify action for each email. "
            "You may also use batch_classify to classify multiple emails at once."
        ),
        "difficulty": "easy",
        "max_steps": 15,
        "n_emails": 10,
        "scoring_criteria": [
            "1.0 point for exact category match per email (normalized)",
            "Partial credit for adjacent categories (e.g., spam vs newsletter)",
            "Bonus for correctly identifying executive/legal emails",
            "-0.02 penalty for re-classifying already processed emails",
        ],
    },
    "task_prioritize": {
        "name": "Priority Ranking",
        "description": (
            "Classify AND assign a priority level (critical, high, medium, low) to 15 emails. "
            "Use classify action for categories and prioritize action for priority levels. "
            "Or use batch_classify and batch_prioritize for efficiency."
        ),
        "difficulty": "medium",
        "max_steps": 20,
        "n_emails": 15,
        "scoring_criteria": [
            "50% weight on category accuracy (with partial credit)",
            "50% weight on priority correctness (adjacent priorities get 0.5 credit)",
            "+15% bonus for correctly identifying AND prioritizing critical emails",
            "-3% penalty per missed critical email (scored as non-critical)",
        ],
    },
    "task_full_triage": {
        "name": "Full Triage Pipeline",
        "description": (
            "Process 20 emails through a complete triage pipeline: "
            "(1) classify each email by category, "
            "(2) assign priority levels, "
            "(3) draft professional replies for all emails requiring response, "
            "(4) escalate all critical priority emails, "
            "(5) archive all spam and newsletter emails. "
            "Scoring is a 5-component weighted composite."
        ),
        "difficulty": "hard",
        "max_steps": 30,
        "n_emails": 20,
        "scoring_criteria": [
            "25% classification accuracy across all emails",
            "20% priority ranking correctness (critical emails penalized heavily if missed)",
            "25% reply quality (length, professionalism, context-appropriate content)",
            "20% escalation F1-score (precision + recall on critical emails)",
            "10% pipeline completeness (spam/newsletter archived correctly)",
        ],
    },
}


class EmailTriageEnv:
    """
    Real-world email triage environment implementing the OpenEnv spec.

    Simulates the daily challenge of processing a corporate inbox:
    classify emails, set priorities, draft replies, escalate critical items.
    """

    def __init__(self):
        self._state: Optional[EpisodeState] = None
        self._grader = None

    def reset(
        self,
        task_id: str,
        agent_name: str = "agent",
        seed: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> Observation:
        """Initialize a new episode. Returns the initial observation."""
        if task_id not in TASKS:
            raise ValueError(f"Unknown task_id: {task_id}. Valid: {list(TASKS.keys())}")

        task_cfg = TASKS[task_id]
        if seed is None:
            import random
            seed = random.randint(0, 99999)

        n_emails = task_cfg["n_emails"]
        emails = generate_email_dataset(n=n_emails, seed=seed)

        if session_id is None:
            session_id = str(uuid.uuid4())

        self._state = EpisodeState(
            session_id=session_id,
            task_id=task_id,
            agent_name=agent_name,
            step_count=0,
            total_reward=0.0,
            done=False,
            emails=emails,
            actions_taken=[],
            classified={},
            prioritized={},
            replied={},
            archived=[],
            escalated=[],
            current_score=0.0,
        )

        # Set up grader
        if task_id == "task_classify":
            self._grader = ClassificationGrader()
        elif task_id == "task_prioritize":
            self._grader = PriorityRankingGrader()
        else:
            self._grader = FullTriageGrader()

        return self._make_observation()

    def step(self, action: Action) -> Tuple[Observation, float, bool, StepInfo]:
        """
        Take an action in the environment.
        Returns (observation, reward, done, info).
        """
        if self._state is None:
            raise RuntimeError("Call reset() before step()")

        state = self._state
        task_cfg = TASKS[state.task_id]
        max_steps = task_cfg["max_steps"]

        # Check if already done
        if state.done:
            obs = self._make_observation()
            info = StepInfo(
                action_valid=False,
                action_feedback="Episode is already complete.",
                partial_score=0.0,
                cumulative_score=state.current_score,
                emails_processed=self._count_processed(),
                emails_remaining=len(state.emails) - self._count_processed(),
                penalty_applied=False,
            )
            return obs, 0.0, True, info

        state.step_count += 1
        state.actions_taken.append(action)

        reward, feedback, penalty_applied = self._execute_action(action)

        state.total_reward += reward
        state.current_score = self._compute_current_score()

        # Check done conditions
        all_processed = self._count_processed() >= len(state.emails)
        out_of_steps = state.step_count >= max_steps
        done = all_processed or out_of_steps

        if done:
            state.done = True
            # Final score computation
            state.current_score = self._grader.final_score(state)

        info = StepInfo(
            action_valid=reward >= 0.0,
            action_feedback=feedback,
            partial_score=max(0.0, reward),
            cumulative_score=state.current_score,
            emails_processed=self._count_processed(),
            emails_remaining=len(state.emails) - self._count_processed(),
            penalty_applied=penalty_applied,
        )

        obs = self._make_observation(last_feedback=feedback)
        return obs, reward, done, info

    def state(self) -> EpisodeState:
        """Return the current full episode state."""
        if self._state is None:
            raise RuntimeError("Call reset() before state()")
        return self._state

    def get_task_info(self, task_id: str) -> TaskInfo:
        """Return metadata about a task."""
        if task_id not in TASKS:
            raise ValueError(f"Unknown task: {task_id}")
        cfg = TASKS[task_id]
        return TaskInfo(
            task_id=task_id,
            name=cfg["name"],
            description=cfg["description"],
            difficulty=cfg["difficulty"],
            max_steps=cfg["max_steps"],
            scoring_criteria=cfg["scoring_criteria"],
        )

    def _execute_action(self, action: Action) -> Tuple[float, str, bool]:
        """Execute an action and return (reward, feedback, penalty_applied)."""
        state = self._state
        task_id = state.task_id
        action_type = action.action_type

        # ---- CLASSIFY (single) ----
        if action_type == "classify":
            email = self._find_email(action.email_id)
            if email is None:
                return -0.02, f"Email '{action.email_id}' not found.", True
            if not action.category:
                return -0.02, "classify action requires 'category' field.", True

            if task_id == "task_classify":
                reward = self._grader.grade_step(email, action.category, state)
            elif task_id == "task_prioritize":
                reward = self._grader.grade_step(email, action.category, None, state)
            else:
                reward = self._grader.grade_classify_step(email, action.category, state)

            state.classified[email.id] = action.category
            self._mark_processed_if_done(email, state)

            correct = email.category == action.category
            feedback = (
                f"Classified '{email.subject[:40]}' as {action.category}. "
                + ("✓ Correct!" if correct else f"✗ Actual: {email.category}")
            )
            return reward, feedback, reward < 0

        # ---- PRIORITIZE (single) ----
        elif action_type == "prioritize":
            email = self._find_email(action.email_id)
            if email is None:
                return -0.02, f"Email '{action.email_id}' not found.", True
            if not action.priority:
                return -0.02, "prioritize action requires 'priority' field.", True

            if task_id == "task_prioritize":
                reward = self._grader.grade_step(email, None, action.priority, state)
            elif task_id == "task_full_triage":
                reward = self._grader.grade_priority_step(email, action.priority, state)
            else:
                reward = 0.0

            state.prioritized[email.id] = action.priority
            self._mark_processed_if_done(email, state)

            correct = email.priority == action.priority
            feedback = (
                f"Prioritized '{email.subject[:40]}' as {action.priority}. "
                + ("✓ Correct!" if correct else f"✗ Actual: {email.priority}")
            )
            return reward, feedback, reward < 0

        # ---- REPLY ----
        elif action_type == "reply":
            email = self._find_email(action.email_id)
            if email is None:
                return -0.02, f"Email '{action.email_id}' not found.", True
            if not action.reply_text:
                return -0.02, "reply action requires 'reply_text' field.", True

            if task_id == "task_full_triage":
                reward = self._grader.grade_reply_step(email, action.reply_text, state)
            else:
                reward = 0.0

            state.replied[email.id] = action.reply_text
            self._mark_processed_if_done(email, state)

            feedback = f"Reply drafted for '{email.subject[:40]}'. Quality score: {reward:.2f}"
            return reward, feedback, reward < 0

        # ---- ESCALATE ----
        elif action_type == "escalate":
            email = self._find_email(action.email_id)
            if email is None:
                return -0.02, f"Email '{action.email_id}' not found.", True

            if task_id == "task_full_triage":
                reward = self._grader.grade_escalation_step(email, state)
            else:
                reward = 0.0

            if email.id not in state.escalated:
                state.escalated.append(email.id)
            self._mark_processed_if_done(email, state)

            feedback = f"Escalated '{email.subject[:40]}'." + (" ✓" if email.priority == "critical" else " ✗ Not critical")
            return reward, feedback, reward < 0

        # ---- ARCHIVE ----
        elif action_type == "archive":
            email = self._find_email(action.email_id)
            if email is None:
                return -0.02, f"Email '{action.email_id}' not found.", True

            if task_id == "task_full_triage":
                reward = self._grader.grade_archive_step(email, state)
            else:
                reward = 0.0

            if email.id not in state.archived:
                state.archived.append(email.id)
            email.is_processed = True

            feedback = f"Archived '{email.subject[:40]}'." + (" ✓" if email.category in ("spam", "newsletter") else " ✗")
            return reward, feedback, reward < 0

        # ---- FLAG ----
        elif action_type == "flag":
            return 0.0, "Email flagged for review.", False

        # ---- BATCH CLASSIFY ----
        elif action_type == "batch_classify":
            if not action.email_ids or not action.categories:
                return -0.02, "batch_classify requires 'email_ids' and 'categories'.", True
            if len(action.email_ids) != len(action.categories):
                return -0.02, "email_ids and categories must have same length.", True

            total_reward = 0.0
            results = []
            for eid, cat in zip(action.email_ids, action.categories):
                email = self._find_email(eid)
                if email is None:
                    continue
                if task_id == "task_classify":
                    r = self._grader.grade_step(email, cat, state)
                elif task_id == "task_prioritize":
                    r = self._grader.grade_step(email, cat, None, state)
                else:
                    r = self._grader.grade_classify_step(email, cat, state)
                state.classified[email.id] = cat
                self._mark_processed_if_done(email, state)
                total_reward += r
                correct = email.category == cat
                results.append(f"{email.subject[:25]}: {'✓' if correct else '✗'}")

            feedback = f"Batch classified {len(action.email_ids)} emails. " + ", ".join(results[:3])
            return total_reward, feedback, total_reward < 0

        # ---- BATCH PRIORITIZE ----
        elif action_type == "batch_prioritize":
            if not action.email_ids or not action.priorities:
                return -0.02, "batch_prioritize requires 'email_ids' and 'priorities'.", True
            if len(action.email_ids) != len(action.priorities):
                return -0.02, "email_ids and priorities must have same length.", True

            total_reward = 0.0
            for eid, pri in zip(action.email_ids, action.priorities):
                email = self._find_email(eid)
                if email is None:
                    continue
                if task_id == "task_prioritize":
                    r = self._grader.grade_step(email, None, pri, state)
                elif task_id == "task_full_triage":
                    r = self._grader.grade_priority_step(email, pri, state)
                else:
                    r = 0.0
                state.prioritized[email.id] = pri
                self._mark_processed_if_done(email, state)
                total_reward += r

            feedback = f"Batch prioritized {len(action.email_ids)} emails. Total reward: {total_reward:.3f}"
            return total_reward, feedback, total_reward < 0

        else:
            return -0.02, f"Unknown action type: '{action_type}'.", True

    def _find_email(self, email_id: Optional[str]) -> Optional[Email]:
        if not email_id or self._state is None:
            return None
        for email in self._state.emails:
            if email.id == email_id:
                return email
        return None

    def _mark_processed_if_done(self, email: Email, state: EpisodeState) -> None:
        """Mark email as processed based on task requirements."""
        task_id = state.task_id
        if task_id == "task_classify":
            if email.id in state.classified:
                email.is_processed = True
        elif task_id == "task_prioritize":
            if email.id in state.classified and email.id in state.prioritized:
                email.is_processed = True
        else:  # full_triage
            classified = email.id in state.classified
            prioritized = email.id in state.prioritized
            replied_ok = not email.requires_reply or email.id in state.replied
            archived_ok = email.category not in ("spam", "newsletter") or email.id in state.archived
            escalated_ok = email.priority != "critical" or email.id in state.escalated
            if classified and prioritized and replied_ok and archived_ok and escalated_ok:
                email.is_processed = True

    def _count_processed(self) -> int:
        if self._state is None:
            return 0
        return sum(1 for e in self._state.emails if e.is_processed)

    def _compute_current_score(self) -> float:
        """Compute intermediate score during episode."""
        if self._state is None:
            return 0.0
        return self._grader.final_score(self._state)

    def _make_observation(self, last_feedback: Optional[str] = None) -> Observation:
        """Build an Observation from current state (without ground-truth labels)."""
        state = self._state
        task_cfg = TASKS[state.task_id]
        time_remaining = task_cfg["max_steps"] - state.step_count

        # Return emails without ground-truth labels
        inbox = [e.to_agent_view() for e in state.emails]

        return Observation(
            inbox=inbox,
            step_count=state.step_count,
            time_remaining=max(0, time_remaining),
            context=task_cfg["description"],
            performance_hint=last_feedback,
        )
