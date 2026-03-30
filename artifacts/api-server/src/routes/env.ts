import { Router, type IRouter } from "express";
import { db, sessionsTable, stepRecordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// In-memory store for active sessions (ephemeral per server restart)
const activeSessions = new Map<string, any>();

// Task configurations
const TASKS: Record<string, any> = {
  task_classify: {
    name: "Email Classification",
    description:
      "Classify 10 emails into the correct category: sales, support, legal, hr, executive, spam, newsletter, or personal. Use the classify action for each email. You may also use batch_classify to classify multiple emails at once.",
    difficulty: "easy",
    max_steps: 15,
    n_emails: 10,
    scoring_criteria: [
      "1.0 point for exact category match per email (normalized)",
      "Partial credit for adjacent categories (e.g., spam vs newsletter)",
      "Bonus for correctly identifying executive/legal emails",
      "-0.02 penalty for re-classifying already processed emails",
    ],
  },
  task_prioritize: {
    name: "Priority Ranking",
    description:
      "Classify AND assign a priority level (critical, high, medium, low) to 15 emails. Use classify action for categories and prioritize action for priority levels. Or use batch_classify and batch_prioritize for efficiency.",
    difficulty: "medium",
    max_steps: 20,
    n_emails: 15,
    scoring_criteria: [
      "50% weight on category accuracy (with partial credit)",
      "50% weight on priority correctness (adjacent priorities get 0.5 credit)",
      "+15% bonus for correctly identifying AND prioritizing critical emails",
      "-3% penalty per missed critical email (scored as non-critical)",
    ],
  },
  task_full_triage: {
    name: "Full Triage Pipeline",
    description:
      "Process 20 emails through a complete triage pipeline: classify each email by category, assign priority levels, draft professional replies for emails requiring response, escalate all critical priority emails, and archive all spam and newsletter emails. Scoring is a 5-component weighted composite.",
    difficulty: "hard",
    max_steps: 30,
    n_emails: 20,
    scoring_criteria: [
      "25% classification accuracy across all emails",
      "20% priority ranking correctness (critical emails penalized heavily if missed)",
      "25% reply quality (length, professionalism, context-appropriate content)",
      "20% escalation F1-score (precision + recall on critical emails)",
      "10% pipeline completeness (spam/newsletter archived correctly)",
    ],
  },
};

// Email templates for dataset generation
const EMAIL_TEMPLATES = [
  {
    subject: "Partnership opportunity with {company}",
    sender: "alex.morgan@{domain}",
    body: "Hi,\n\nI'm reaching out on behalf of {company}. We offer enterprise software solutions that could save your team significant time. Our clients report 40% productivity gains.\n\nWould you be open to a 15-minute call this week?\n\nBest,\nAlex Morgan",
    category: "sales",
    priority: "low",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Q4 pricing proposal - ready for your review",
    sender: "sales@{domain}",
    body: "Dear Team,\n\nAttached please find our updated Q4 pricing proposal for the enterprise license. We've included volume discounts based on your requirements and a 30-day pilot option.\n\nThis offer expires end of month.",
    category: "sales",
    priority: "medium",
    has_attachment: true,
    requires_reply: true,
  },
  {
    subject: "Production outage - API returning 500 errors",
    sender: "oncall@{domain}",
    body: "URGENT: Our production API has been returning 500 errors for the past 30 minutes. All customer-facing services are affected. Error logs show database connection pool exhaustion.\n\nCustomers are reporting inability to login. Revenue impact approximately $50k/hour.\n\nNeed immediate escalation to engineering on-call team.",
    category: "support",
    priority: "critical",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Cannot export report to PDF",
    sender: "user@{domain}",
    body: "Hi Support,\n\nI'm having trouble exporting my monthly report to PDF format. The export button seems to work but the file never downloads. I've tried in Chrome and Firefox.\n\nThis is blocking my end-of-month reporting. Can you help?\n\nThanks,\nJamie",
    category: "support",
    priority: "medium",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "General question about billing cycle",
    sender: "billing@{domain}",
    body: "Hello,\n\nI have a quick question about when my billing cycle resets each month. Could you confirm the exact date so I can plan our budget accordingly?\n\nThanks!",
    category: "support",
    priority: "low",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "NDA required before technical disclosure",
    sender: "legal@{domain}",
    body: "Dear Partners,\n\nBefore we can share the technical architecture details, we need an executed NDA from your legal team.\n\nAttached is our standard NDA template. Please have it reviewed and returned signed by Friday EOD.\n\nThis is a hard requirement before any technical discussions can proceed.",
    category: "legal",
    priority: "high",
    has_attachment: true,
    requires_reply: true,
  },
  {
    subject: "GDPR compliance audit - urgent documentation needed",
    sender: "compliance@{domain}",
    body: "IMPORTANT: Our annual GDPR compliance audit is scheduled for next Tuesday. The auditors require documentation by Monday:\n\n1. Data processing records\n2. Privacy impact assessments\n3. Data retention policies\n4. Breach notification procedures\n\nFailure to provide these documents may result in regulatory penalties.",
    category: "legal",
    priority: "critical",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Open enrollment deadline - action required by Friday",
    sender: "hr@{domain}",
    body: "Hi,\n\nThis is a reminder that the benefits open enrollment period closes this Friday at 5pm ET.\n\nIf you don't make selections, you'll be auto-enrolled in the default plan which may not be optimal.\n\nPlease log into the HR portal to review and confirm your selections.\n\nHR Team",
    category: "hr",
    priority: "high",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Performance review cycle starting next week",
    sender: "hr@{domain}",
    body: "Team,\n\nOur semi-annual performance review cycle begins next Monday. Please ensure you complete your self-assessment in Workday by March 15th.\n\nManagers should schedule 1:1 review meetings for the last week of March.\n\nThank you,\nPeople Operations",
    category: "hr",
    priority: "medium",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Board meeting prep - deck review needed ASAP",
    sender: "ceo@{domain}",
    body: "Team,\n\nThe Q4 board meeting is in 48 hours and I need everyone to review the attached deck and provide feedback by tonight.\n\nPay special attention to slides 8-12 (financial projections) and slide 23 (competitive landscape). The board will scrutinize these heavily.\n\nDo NOT share this externally - NDA applies.\n\n- Sarah",
    category: "executive",
    priority: "critical",
    has_attachment: true,
    requires_reply: true,
  },
  {
    subject: "Strategic planning offsite - save the date",
    sender: "exec-assistant@{domain}",
    body: "Please save March 15-17 for our annual strategic planning offsite at Napa Valley.\n\nFlight arrangements and hotel blocks will be coordinated by the executive assistant team. Please respond to confirm attendance by end of this week.",
    category: "executive",
    priority: "medium",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Congratulations! You've been selected for a $500 gift card",
    sender: "noreply@prizewinners.xyz",
    body: "CONGRATULATIONS! You've been randomly selected to receive a $500 Amazon gift card!\n\nClick here to claim your prize: http://claim-prize-now.xyz/gift500\n\nOffer expires in 24 hours. Act now!\n\n*This is not spam. You signed up for our newsletter at some point.*",
    category: "spam",
    priority: "low",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Make $5000/week from home - no experience needed!",
    sender: "opportunities@workfromhome.info",
    body: "Are you tired of your 9-5? We have a REVOLUTIONARY opportunity that allows ordinary people to make extraordinary income!\n\nNo experience needed. No investment required. Just 2 hours per day.\n\nJoin 50,000+ people already living their dream life! Click to learn more >>",
    category: "spam",
    priority: "low",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "This week in AI: GPT-5 rumors, Claude updates, and more",
    sender: "newsletter@ainewsletter.io",
    body: "Welcome to your weekly AI digest!\n\n📰 TOP STORIES:\n• OpenAI rumored to release GPT-5 next quarter\n• Anthropic announces Claude 3.5 Sonnet improvements\n• Google DeepMind's new AlphaCode results published\n\n📊 AI funding reached $18B in Q1 2025\n\nRead the full newsletter at our website.",
    category: "newsletter",
    priority: "low",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Product update: New features released this sprint",
    sender: "product-updates@saas.io",
    body: "Hi there,\n\nWe've shipped some exciting new features this sprint:\n\n✅ Dark mode is now available in all views\n✅ CSV export for all reports\n✅ New keyboard shortcuts (press ? to see all)\n✅ Bulk operations on list views\n\nFull changelog: https://docs.example.com/changelog",
    category: "newsletter",
    priority: "low",
    has_attachment: false,
    requires_reply: false,
  },
  {
    subject: "Lunch tomorrow?",
    sender: "friend@gmail.com",
    body: "Hey!\n\nAre you free for lunch tomorrow? I'm thinking tacos at 12:30pm. Let me know if that works!\n\nCheers",
    category: "personal",
    priority: "low",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Birthday dinner this Saturday",
    sender: "family@gmail.com",
    body: "Hi,\n\nJust a reminder that Dad's 60th birthday dinner is this Saturday at 7pm at La Maison restaurant.\n\nPlease let me know if you can make it. We have a reservation for 12 people.\n\nLove,\nMom",
    category: "personal",
    priority: "medium",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Security breach detected - immediate action required",
    sender: "security@{domain}",
    body: "CRITICAL SECURITY ALERT\n\nOur security monitoring has detected unusual access patterns suggesting a potential data breach.\n\nAffected systems: Customer database, authentication service\nSuspected vectors: Compromised credentials\n\nImmediate actions required:\n1. Rotate all service account credentials\n2. Enable enhanced logging\n3. Brief the incident response team\n4. Prepare breach notification if confirmed",
    category: "support",
    priority: "critical",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Acquisition offer - strictly confidential",
    sender: "cfo@{domain}",
    body: "STRICTLY CONFIDENTIAL - DO NOT FORWARD\n\nWe have received a preliminary acquisition offer from a strategic buyer at a significant premium to our current valuation.\n\nThe board has convened an emergency session for Thursday. All C-suite must attend.\n\nPlease confirm attendance immediately. Details will be shared verbally only.",
    category: "executive",
    priority: "critical",
    has_attachment: false,
    requires_reply: true,
  },
  {
    subject: "Your free trial is expiring in 3 days",
    sender: "trials@saasplatform.com",
    body: "Hi,\n\nYour 14-day free trial of our platform expires in 3 days.\n\nTo continue using all features, please upgrade to one of our paid plans.\n\nOur most popular plan starts at $49/month. Use code TRIAL20 for 20% off your first 3 months.",
    category: "sales",
    priority: "medium",
    has_attachment: false,
    requires_reply: false,
  },
];

const DOMAINS = ["techcorp.com", "innovate.io", "enterprise.co", "startupco.com", "megacorp.net"];
const COMPANIES = ["TechVentures", "CloudScale", "DataSphere", "AIForward", "NextGen Solutions"];

function seededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function generateEmails(n: number, seed: number = 42) {
  const rng = seededRandom(seed);
  const templates = [...EMAIL_TEMPLATES];

  // Fisher-Yates shuffle with seeded RNG
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [templates[i], templates[j]] = [templates[j], templates[i]];
  }

  return templates.slice(0, n).map((tmpl, i) => {
    const domain = DOMAINS[Math.floor(rng() * DOMAINS.length)];
    const company = COMPANIES[Math.floor(rng() * COMPANIES.length)];
    const hoursAgo = Math.floor(rng() * 72);
    const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();

    const fmt = (s: string) =>
      s.replace(/\{domain\}/g, domain).replace(/\{company\}/g, company);

    return {
      id: `email_${i.toString().padStart(3, "0")}_${Math.floor(rng() * 9000 + 1000)}`,
      subject: fmt(tmpl.subject),
      sender: fmt(tmpl.sender),
      sender_domain: domain,
      body: fmt(tmpl.body),
      timestamp: ts,
      category: tmpl.category,
      priority: tmpl.priority,
      has_attachment: tmpl.has_attachment,
      thread_id: null,
      requires_reply: tmpl.requires_reply,
      is_processed: false,
    };
  });
}

// Grading helpers
const CATEGORY_SIMILARITY: Record<string, number> = {
  "sales|newsletter": 0.3,
  "newsletter|sales": 0.3,
  "spam|newsletter": 0.4,
  "newsletter|spam": 0.4,
  "legal|executive": 0.3,
  "executive|legal": 0.3,
  "hr|executive": 0.2,
  "executive|hr": 0.2,
  "support|executive": 0.2,
  "executive|support": 0.2,
  "personal|newsletter": 0.2,
  "newsletter|personal": 0.2,
};

const PRIORITY_ORDER: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

function categoryScore(predicted: string, actual: string): number {
  if (predicted === actual) return 1.0;
  return CATEGORY_SIMILARITY[`${predicted}|${actual}`] ?? 0.0;
}

function priorityScore(predicted: string, actual: string): number {
  if (predicted === actual) return 1.0;
  const diff = Math.abs((PRIORITY_ORDER[predicted] ?? 0) - (PRIORITY_ORDER[actual] ?? 0));
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.5;
  if (diff === 2) return 0.2;
  return 0.0;
}

function replyQualityScore(replyText: string, email: any): number {
  if (!replyText || replyText.trim().length < 10) return 0.0;
  let score = 0.0;
  const lower = replyText.toLowerCase();

  if (replyText.length >= 50) score += 0.2;
  if (replyText.length >= 150) score += 0.1;

  const greetings = ["hi ", "hello", "dear ", "good morning", "good afternoon"];
  if (greetings.some((g) => lower.includes(g))) score += 0.1;

  const closings = ["regards", "sincerely", "best", "thank you", "thanks", "cheers"];
  if (closings.some((c) => lower.includes(c))) score += 0.1;

  const categoryKws: Record<string, string[]> = {
    support: ["issue", "help", "resolve", "fix", "look into", "investigate"],
    legal: ["document", "review", "counsel", "compliance", "confirm"],
    executive: ["meeting", "agenda", "confirm", "attend", "discuss"],
    sales: ["interested", "discuss", "call", "schedule"],
    hr: ["confirm", "completed", "portal", "deadline"],
    personal: ["sure", "sounds", "works", "yes"],
  };

  if (email.category && categoryKws[email.category]) {
    const matches = categoryKws[email.category].filter((kw) => lower.includes(kw)).length;
    score += Math.min(0.3, matches * 0.1);
  }

  if (email.priority === "critical") {
    const urgency = ["immediately", "urgent", "asap", "right away", "priority", "escalat"];
    if (urgency.some((w) => lower.includes(w))) score += 0.2;
  }

  return Math.min(1.0, score);
}

function computeScore(state: any): number {
  const emails = state.emails;
  if (!emails || emails.length === 0) return 0.0;
  const n = emails.length;
  const taskId = state.task_id;

  if (taskId === "task_classify") {
    const total = emails.reduce((sum: number, e: any) => {
      if (state.classified[e.id] && e.category) {
        return sum + categoryScore(state.classified[e.id], e.category);
      }
      return sum;
    }, 0);
    return total / n;
  }

  if (taskId === "task_prioritize") {
    const catTotal = emails.reduce((sum: number, e: any) => {
      if (state.classified[e.id] && e.category) {
        return sum + categoryScore(state.classified[e.id], e.category);
      }
      return sum;
    }, 0);
    const priTotal = emails.reduce((sum: number, e: any) => {
      if (state.prioritized[e.id] && e.priority) {
        return sum + priorityScore(state.prioritized[e.id], e.priority);
      }
      return sum;
    }, 0);
    return (catTotal / n) * 0.5 + (priTotal / n) * 0.5;
  }

  // task_full_triage
  const catTotal = emails.reduce((sum: number, e: any) => {
    if (state.classified[e.id] && e.category) {
      return sum + categoryScore(state.classified[e.id], e.category);
    }
    return sum;
  }, 0);
  const priTotal = emails.reduce((sum: number, e: any) => {
    if (state.prioritized[e.id] && e.priority) {
      return sum + priorityScore(state.prioritized[e.id], e.priority);
    }
    return sum;
  }, 0);

  const replyEmails = emails.filter((e: any) => e.requires_reply);
  const replyScore =
    replyEmails.length > 0
      ? replyEmails.reduce((sum: number, e: any) => {
          if (state.replied[e.id]) {
            return sum + replyQualityScore(state.replied[e.id], e);
          }
          return sum;
        }, 0) / replyEmails.length
      : 1.0;

  const criticalEmails = emails.filter((e: any) => e.priority === "critical");
  let escalationF1 = 1.0;
  if (criticalEmails.length > 0) {
    const correctlyEscalated = criticalEmails.filter((e: any) =>
      state.escalated.includes(e.id)
    ).length;
    const recall = correctlyEscalated / criticalEmails.length;
    const precision =
      state.escalated.length > 0 ? correctlyEscalated / state.escalated.length : 1.0;
    escalationF1 =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
  }

  const noiseEmails = emails.filter((e: any) =>
    ["spam", "newsletter"].includes(e.category)
  );
  const completeness =
    noiseEmails.length > 0
      ? noiseEmails.filter((e: any) => state.archived.includes(e.id)).length /
        noiseEmails.length
      : 1.0;

  return Math.min(
    1.0,
    Math.max(
      0.0,
      (catTotal / n) * 0.25 +
        (priTotal / n) * 0.2 +
        replyScore * 0.25 +
        escalationF1 * 0.2 +
        completeness * 0.1
    )
  );
}

function markProcessed(email: any, state: any): void {
  const taskId = state.task_id;
  if (taskId === "task_classify") {
    if (state.classified[email.id]) email.is_processed = true;
  } else if (taskId === "task_prioritize") {
    if (state.classified[email.id] && state.prioritized[email.id]) email.is_processed = true;
  } else {
    const classified = !!state.classified[email.id];
    const prioritized = !!state.prioritized[email.id];
    const repliedOk = !email.requires_reply || !!state.replied[email.id];
    const archivedOk =
      !["spam", "newsletter"].includes(email.category) || state.archived.includes(email.id);
    const escalatedOk =
      email.priority !== "critical" || state.escalated.includes(email.id);
    if (classified && prioritized && repliedOk && archivedOk && escalatedOk) {
      email.is_processed = true;
    }
  }
}

// POST /env/reset
router.post("/reset", async (req, res): Promise<void> => {
  const { task_id, agent_name = "agent", seed } = req.body;

  if (!task_id || !TASKS[task_id]) {
    res.status(400).json({ error: `Unknown task_id: ${task_id}. Valid: ${Object.keys(TASKS).join(", ")}` });
    return;
  }

  const taskCfg = TASKS[task_id];
  const actualSeed = seed ?? Math.floor(Math.random() * 99999);
  const sessionId = crypto.randomUUID();
  const emails = generateEmails(taskCfg.n_emails, actualSeed);

  const state = {
    session_id: sessionId,
    task_id,
    agent_name,
    step_count: 0,
    total_reward: 0.0,
    done: false,
    emails,
    actions_taken: [],
    classified: {} as Record<string, string>,
    prioritized: {} as Record<string, string>,
    replied: {} as Record<string, string>,
    archived: [] as string[],
    escalated: [] as string[],
    current_score: 0.0,
    seed: actualSeed,
  };

  activeSessions.set(sessionId, state);

  // Persist session to DB
  try {
    await db.insert(sessionsTable).values({
      id: sessionId,
      taskId: task_id,
      agentName: agent_name,
      status: "active",
      stepCount: 0,
      totalReward: 0,
      seed: actualSeed,
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to persist session to DB");
  }

  // Build agent-visible inbox (no ground truth)
  const inbox = emails.map((e: any) => ({ ...e, category: null, priority: null }));

  res.json({
    session_id: sessionId,
    observation: {
      inbox,
      step_count: 0,
      time_remaining: taskCfg.max_steps,
      context: taskCfg.description,
      performance_hint: null,
    },
    task_info: {
      task_id,
      name: taskCfg.name,
      description: taskCfg.description,
      difficulty: taskCfg.difficulty,
      max_steps: taskCfg.max_steps,
      scoring_criteria: taskCfg.scoring_criteria,
    },
  });
});

// POST /env/step
router.post("/step", async (req, res): Promise<void> => {
  const { session_id, action } = req.body;

  if (!session_id || !activeSessions.has(session_id)) {
    res.status(400).json({ error: "Invalid or expired session_id. Call /env/reset first." });
    return;
  }

  const state = activeSessions.get(session_id)!;
  const taskCfg = TASKS[state.task_id];

  if (state.done) {
    res.json({
      observation: buildObservation(state, taskCfg, "Episode already complete."),
      reward: 0,
      done: true,
      info: {
        action_valid: false,
        action_feedback: "Episode is already complete.",
        partial_score: 0,
        cumulative_score: state.current_score,
        emails_processed: state.emails.filter((e: any) => e.is_processed).length,
        emails_remaining: state.emails.filter((e: any) => !e.is_processed).length,
        penalty_applied: false,
      },
    });
    return;
  }

  state.step_count++;
  state.actions_taken.push(action);

  const { reward, feedback, penaltyApplied } = executeAction(action, state);

  state.total_reward += reward;
  state.current_score = computeScore(state);

  const processedCount = state.emails.filter((e: any) => e.is_processed).length;
  const allProcessed = processedCount >= state.emails.length;
  const outOfSteps = state.step_count >= taskCfg.max_steps;
  const done = allProcessed || outOfSteps;

  if (done) {
    state.done = true;
    state.current_score = computeScore(state);

    // Update DB session
    try {
      await db
        .update(sessionsTable)
        .set({
          status: "completed",
          stepCount: state.step_count,
          totalReward: state.total_reward,
          finalScore: state.current_score,
          completedAt: new Date(),
        })
        .where(eq(sessionsTable.id, session_id));
    } catch (err) {
      req.log.warn({ err }, "Failed to update session in DB");
    }
  } else {
    try {
      await db
        .update(sessionsTable)
        .set({ stepCount: state.step_count, totalReward: state.total_reward })
        .where(eq(sessionsTable.id, session_id));
    } catch (err) {
      req.log.warn({ err }, "Failed to update session in DB");
    }
  }

  // Record step
  try {
    await db.insert(stepRecordsTable).values({
      sessionId: session_id,
      stepNumber: state.step_count,
      actionType: action.action_type,
      actionJson: action,
      reward,
      cumulativeReward: state.total_reward,
      infoJson: { feedback, penaltyApplied, score: state.current_score },
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to record step in DB");
  }

  const info = {
    action_valid: reward >= 0,
    action_feedback: feedback,
    partial_score: Math.max(0, reward),
    cumulative_score: state.current_score,
    emails_processed: processedCount,
    emails_remaining: state.emails.length - processedCount,
    penalty_applied: penaltyApplied,
  };

  res.json({
    observation: buildObservation(state, taskCfg, feedback),
    reward,
    done,
    info,
  });
});

// GET /env/state
router.get("/state", async (req, res): Promise<void> => {
  const sessionId = req.query.session_id as string;

  if (!sessionId || !activeSessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or expired session_id." });
    return;
  }

  const state = activeSessions.get(sessionId)!;
  res.json({
    session_id: state.session_id,
    task_id: state.task_id,
    agent_name: state.agent_name,
    step_count: state.step_count,
    total_reward: state.total_reward,
    done: state.done,
    emails: state.emails,
    actions_taken: state.actions_taken,
    current_score: state.current_score,
  });
});

function buildObservation(state: any, taskCfg: any, hint: string | null) {
  const inbox = state.emails.map((e: any) => ({ ...e, category: null, priority: null }));
  return {
    inbox,
    step_count: state.step_count,
    time_remaining: Math.max(0, taskCfg.max_steps - state.step_count),
    context: taskCfg.description,
    performance_hint: hint,
  };
}

function executeAction(
  action: any,
  state: any
): { reward: number; feedback: string; penaltyApplied: boolean } {
  const emails: any[] = state.emails;
  const taskId: string = state.task_id;
  const n = emails.length;

  const findEmail = (id: string) => emails.find((e) => e.id === id) ?? null;

  if (action.action_type === "classify") {
    const email = findEmail(action.email_id);
    if (!email) return { reward: -0.02, feedback: `Email '${action.email_id}' not found.`, penaltyApplied: true };
    if (!action.category) return { reward: -0.02, feedback: "classify requires 'category'.", penaltyApplied: true };

    const cs = categoryScore(action.category, email.category);
    const perEmail = 1.0 / n;
    let reward = cs * perEmail;
    if (taskId === "task_full_triage") reward *= 0.25 / 0.5;

    state.classified[email.id] = action.category;
    markProcessed(email, state);

    const correct = email.category === action.category;
    const feedback = `Classified '${email.subject.slice(0, 40)}' as ${action.category}. ${correct ? "✓ Correct!" : `✗ Actual: ${email.category}`}`;
    return { reward, feedback, penaltyApplied: reward < 0 };
  }

  if (action.action_type === "prioritize") {
    const email = findEmail(action.email_id);
    if (!email) return { reward: -0.02, feedback: `Email '${action.email_id}' not found.`, penaltyApplied: true };
    if (!action.priority) return { reward: -0.02, feedback: "prioritize requires 'priority'.", penaltyApplied: true };

    const ps = priorityScore(action.priority, email.priority);
    const perEmail = 1.0 / n;
    let reward = ps * perEmail;
    if (taskId === "task_prioritize") reward *= 0.5;
    if (taskId === "task_full_triage") reward *= 0.2 / 0.5;

    // Critical miss penalty
    if (email.priority === "critical" && !["critical", "high"].includes(action.priority)) {
      reward -= 0.03 * perEmail;
    }

    state.prioritized[email.id] = action.priority;
    markProcessed(email, state);

    const correct = email.priority === action.priority;
    const feedback = `Prioritized '${email.subject.slice(0, 40)}' as ${action.priority}. ${correct ? "✓" : `✗ Actual: ${email.priority}`}`;
    return { reward: Math.max(-0.1, reward), feedback, penaltyApplied: reward < 0 };
  }

  if (action.action_type === "reply") {
    const email = findEmail(action.email_id);
    if (!email) return { reward: -0.02, feedback: `Email '${action.email_id}' not found.`, penaltyApplied: true };
    if (!action.reply_text) return { reward: -0.02, feedback: "reply requires 'reply_text'.", penaltyApplied: true };

    let reward = 0.0;
    if (taskId === "task_full_triage") {
      if (!email.requires_reply) {
        if (["spam", "newsletter"].includes(email.category)) reward = -0.02;
      } else {
        const replyEmails = emails.filter((e) => e.requires_reply);
        const q = replyQualityScore(action.reply_text, email);
        reward = q * (0.25 / Math.max(1, replyEmails.length));
      }
    }

    state.replied[email.id] = action.reply_text;
    markProcessed(email, state);

    const feedback = `Reply drafted for '${email.subject.slice(0, 40)}'. Quality: ${reward.toFixed(3)}`;
    return { reward, feedback, penaltyApplied: reward < 0 };
  }

  if (action.action_type === "escalate") {
    const email = findEmail(action.email_id);
    if (!email) return { reward: -0.02, feedback: `Email '${action.email_id}' not found.`, penaltyApplied: true };

    let reward = 0.0;
    if (taskId === "task_full_triage") {
      const criticalEmails = emails.filter((e) => e.priority === "critical");
      if (email.priority === "critical") {
        reward = 0.2 / Math.max(1, criticalEmails.length);
      } else {
        reward = -0.05;
      }
    }

    if (!state.escalated.includes(email.id)) state.escalated.push(email.id);
    markProcessed(email, state);

    const feedback = `Escalated '${email.subject.slice(0, 40)}'. ${email.priority === "critical" ? "✓ Correct!" : "✗ Not critical"}`;
    return { reward, feedback, penaltyApplied: reward < 0 };
  }

  if (action.action_type === "archive") {
    const email = findEmail(action.email_id);
    if (!email) return { reward: -0.02, feedback: `Email '${action.email_id}' not found.`, penaltyApplied: true };

    let reward = 0.0;
    if (taskId === "task_full_triage") {
      const noiseEmails = emails.filter((e) => ["spam", "newsletter"].includes(e.category));
      if (["spam", "newsletter"].includes(email.category)) {
        reward = 0.1 / Math.max(1, noiseEmails.length);
      } else {
        reward = -0.05;
      }
    }

    if (!state.archived.includes(email.id)) state.archived.push(email.id);
    email.is_processed = true;

    const feedback = `Archived '${email.subject.slice(0, 40)}'. ${["spam", "newsletter"].includes(email.category) ? "✓" : "✗ Not spam/newsletter"}`;
    return { reward, feedback, penaltyApplied: reward < 0 };
  }

  if (action.action_type === "flag") {
    return { reward: 0, feedback: "Email flagged for review.", penaltyApplied: false };
  }

  if (action.action_type === "batch_classify") {
    const { email_ids, categories } = action;
    if (!email_ids || !categories || email_ids.length !== categories.length) {
      return { reward: -0.02, feedback: "batch_classify requires matching email_ids and categories arrays.", penaltyApplied: true };
    }

    let totalReward = 0;
    const results: string[] = [];
    for (let i = 0; i < email_ids.length; i++) {
      const email = findEmail(email_ids[i]);
      if (!email) continue;
      const cs = categoryScore(categories[i], email.category);
      const perEmail = 1.0 / n;
      totalReward += cs * perEmail;
      state.classified[email.id] = categories[i];
      markProcessed(email, state);
      results.push(`${email.subject.slice(0, 20)}: ${email.category === categories[i] ? "✓" : "✗"}`);
    }

    return {
      reward: totalReward,
      feedback: `Batch classified ${email_ids.length} emails. ${results.slice(0, 3).join(", ")}`,
      penaltyApplied: totalReward < 0,
    };
  }

  if (action.action_type === "batch_prioritize") {
    const { email_ids, priorities } = action;
    if (!email_ids || !priorities || email_ids.length !== priorities.length) {
      return { reward: -0.02, feedback: "batch_prioritize requires matching email_ids and priorities arrays.", penaltyApplied: true };
    }

    let totalReward = 0;
    for (let i = 0; i < email_ids.length; i++) {
      const email = findEmail(email_ids[i]);
      if (!email) continue;
      const ps = priorityScore(priorities[i], email.priority);
      totalReward += ps * (1.0 / n) * 0.5;
      state.prioritized[email.id] = priorities[i];
      markProcessed(email, state);
    }

    return {
      reward: totalReward,
      feedback: `Batch prioritized ${email_ids.length} emails. Total reward: ${totalReward.toFixed(3)}`,
      penaltyApplied: totalReward < 0,
    };
  }

  return { reward: -0.02, feedback: `Unknown action type: '${action.action_type}'.`, penaltyApplied: true };
}

export default router;
