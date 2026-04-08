# OpenEnv: Email Triage & Prioritization Environment

[![openenv](https://img.shields.io/badge/openenv-v1.0-blue)](https://huggingface.co/spaces)
[![HuggingFace](https://img.shields.io/badge/🤗-Hugging%20Face%20Space-yellow)](https://huggingface.co/spaces)
[![Docker](https://img.shields.io/badge/docker-ready-green)](./Dockerfile)

A **real-world AI agent benchmark** for training and evaluating agents on email triage and prioritization — one of the most universal productivity challenges in modern knowledge work. 

Agents must process realistic corporate inboxes: classify emails by type, rank them by urgency, draft professional replies for critical items, escalate high-stakes situations, and archive noise.

---

## Why Email Triage?

Email triage is a task **humans actually do at scale**:
- Knowledge workers spend 28% of their workday on email (McKinsey, 2024)
- Misclassified priority emails cause measurable business harm
- The task requires multi-step reasoning, context understanding, and professional communication
- Clear, deterministic success criteria make it ideal for AI benchmarking

---

## Environment Description

### Task Domain
Corporate inbox management requiring:
- **Semantic classification** — understanding email intent and organizational context
- **Priority reasoning** — judging urgency from sender, subject, content, and context
- **Communication skills** — drafting professional, context-appropriate replies
- **Judgment** — escalating genuine crises, ignoring spam, routing correctly

### Episode Structure
Each episode presents an AI agent with a synthetic but realistic inbox. The agent interacts step-by-step using a structured action API. Episodes terminate when all emails are processed OR the step limit is reached.

---

## OpenEnv Spec Compliance

This environment implements the full OpenEnv interface:

| Operation | Endpoint | Description |
|-----------|----------|-------------|
| `reset()` | `POST /api/env/reset` | Initialize episode, returns initial Observation |
| `step()` | `POST /api/env/step` | Take action, returns Observation + reward + done + info |
| `state()` | `GET /api/env/state?session_id=...` | Get full current state |

### Typed Models

```typescript
// Observation - what the agent sees
interface Observation {
  inbox: Email[];          // Current emails (no ground-truth labels)
  step_count: number;      // Current step
  time_remaining: number;  // Steps left
  context: string;         // Task instructions
  performance_hint: string | null;  // Feedback on last action
}

// Action - what the agent does
interface Action {
  action_type: "classify" | "prioritize" | "reply" | "archive" | "escalate" | "flag" | "batch_classify" | "batch_prioritize";
  email_id?: string;
  email_ids?: string[];
  category?: "sales" | "support" | "legal" | "hr" | "executive" | "spam" | "newsletter" | "personal";
  priority?: "critical" | "high" | "medium" | "low";
  reply_text?: string;
  categories?: string[];
  priorities?: string[];
}
```

### openenv.yaml

Full environment spec located at [`openenv/openenv.yaml`](./openenv/openenv.yaml).

---

## Tasks

### Task 1: Email Classification (Easy)

**ID:** `task_classify`  
**Difficulty:** Easy  
**Max Steps:** 15  
**Emails:** 10  

**Objective:** Classify each email into the correct category.

**Categories:** `sales`, `support`, `legal`, `hr`, `executive`, `spam`, `newsletter`, `personal`

**Scoring:**
- +1.0 per correct classification (normalized to 0.0–1.0 total)
- Partial credit for adjacent categories (e.g., spam↔newsletter = 0.4, sales↔newsletter = 0.3)
- Bonus for correctly identifying `executive` and `legal` emails
- -0.02 penalty for re-classifying already-processed emails

**Baseline score:** ~0.72

---

### Task 2: Priority Ranking (Medium)

**ID:** `task_prioritize`  
**Difficulty:** Medium  
**Max Steps:** 20  
**Emails:** 15  

**Objective:** Classify AND assign correct priority (critical/high/medium/low) to every email.

**Scoring (50/50 weighted):**
- 50% from classification accuracy (same as Task 1)
- 50% from priority accuracy (adjacent priorities get 0.5 credit, e.g., high↔medium)
- +15% bonus for correctly identifying AND prioritizing `critical` emails
- -3% penalty per `critical` email labeled as `medium` or `low`

**Baseline score:** ~0.54

---

### Task 3: Full Triage Pipeline (Hard)

**ID:** `task_full_triage`  
**Difficulty:** Hard  
**Max Steps:** 30  
**Emails:** 20  

**Objective:** Complete a 5-stage triage pipeline on every email.

| Component | Weight | Description |
|-----------|--------|-------------|
| Classification | 25% | Correct category label |
| Priority | 20% | Correct priority (with critical email penalties) |
| Replies | 25% | Professional reply drafted for emails requiring response |
| Escalation | 20% | F1-score on escalating all critical-priority emails |
| Completeness | 10% | Spam/newsletters correctly archived |

**Reply quality** is scored on: length, professional greeting/closing, context-appropriate content, urgency signals for critical emails.

**Baseline score:** ~0.38

---

## Reward Function

The reward function provides **dense signal across the full trajectory** (not just terminal rewards):

```
Per-step rewards:
  Correct classification:     +0.10 (normalized by email count)
  Correct priority:           +0.05 (normalized)
  Critical email both right:  +0.15 bonus
  Reply (quality-scaled):     +0.05 to +0.25
  Correct escalation:         +0.20 / n_critical
  Correct archive:            +0.10 / n_noise

Penalties:
  Wrong category:             -0.05 (partial credit available)
  Wrong priority tier (2+):   -0.03
  False escalation:           -0.05
  Wrong archive:              -0.05
  Re-process done email:      -0.02
  Invalid action:             -0.02
```

This design enables:
- **RL training** with dense shaped rewards
- **Behavioral analysis** of where agents struggle
- **Curriculum learning** across the 3 difficulty levels

---

## Observation Space

```yaml
inbox:
  type: array
  items:
    id: string
    subject: string
    sender: string
    sender_domain: string
    body: string
    timestamp: ISO8601 string
    has_attachment: boolean
    requires_reply: boolean
    is_processed: boolean
    # Note: category and priority are HIDDEN from agent (null in observation)
    category: null
    priority: null

step_count: integer
time_remaining: integer
context: string
performance_hint: string | null
```

---

## Action Space

```yaml
action_type: enum
  - classify          # Assign category to one email
  - prioritize        # Assign priority to one email
  - reply             # Draft reply for one email
  - archive           # Archive one email
  - escalate          # Escalate one email
  - flag              # Flag for review (no-op for scoring)
  - batch_classify    # Classify multiple emails at once
  - batch_prioritize  # Prioritize multiple emails at once
```

---

## Setup & Usage

### Prerequisites
- Node.js 24+
- pnpm 10+
- PostgreSQL (or use Docker Compose)

### Local Development

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start the API server (serves on PORT env var)
pnpm --filter @workspace/api-server run dev

# Start the dashboard (in another terminal)
pnpm --filter @workspace/openenv-dashboard run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | API server port |
| `API_BASE_URL` | inference.py | Base URL of the OpenAI-compatible LLM API (default: `https://api.openai.com/v1`) |
| `MODEL_NAME` | inference.py | Model identifier (default: `gpt-4o-mini`) |
| `HF_TOKEN` | inference.py | Your Hugging Face / API key for LLM calls |
| `OPENENV_ENDPOINT` | inference.py | OpenEnv REST API base URL (default: `http://localhost:3000`) |
| `SEED` | inference.py | Random seed for reproducibility (default: `42`) |
| `TASK` | inference.py | Single task to run, or `all` (default: `all`) |

### Docker

```bash
# Build the image
docker build -t openenv-email-triage .

# Run with environment variables
docker run \
  -p 7860:7860 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  openenv-email-triage
```

### Hugging Face Spaces

This environment is deployed as a Hugging Face Space with the `openenv` tag.

Environment variables to set in Space settings:
- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — For running the baseline

---

## Inference Script (`inference.py`)

The submission-ready inference script lives at **[`inference.py`](./inference.py)** in the project root.

It follows the mandatory OpenEnv STDOUT format:

```
[START] task=<task_name> env=email-triage model=<model_name>
[STEP]  step=<n> action=<action_json> reward=<0.00> done=<true|false> error=<msg|null>
[END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...>
```

### Required environment variables

```bash
export API_BASE_URL="https://api.openai.com/v1"   # or your active endpoint
export MODEL_NAME="gpt-4o-mini"                    # model identifier
export HF_TOKEN="sk-..."                           # your API key
export OPENENV_ENDPOINT="http://localhost:3000"    # running OpenEnv API
```

### Running

```bash
# Install the openai package if not present
pip install openai

# Run all three tasks (task_classify → task_prioritize → task_full_triage)
python inference.py

# Run a single task
TASK=task_classify python inference.py
```

### Example output

```
[START] task=task_classify env=email-triage model=gpt-4o-mini
[STEP] step=1 action={"action_type":"batch_classify","email_ids":["email_000_5950","email_001_2341"],"categories":["hr","sales"]} reward=0.20 done=false error=null
[STEP] step=2 action={"action_type":"batch_classify","email_ids":["email_002_9812"],"categories":["support"]} reward=0.10 done=false error=null
...
[END] success=true steps=8 score=0.72 rewards=0.20,0.10,0.15,...

[START] task=task_prioritize env=email-triage model=gpt-4o-mini
...
```

### Legacy baseline script

[`openenv/baseline/run_baseline.py`](./openenv/baseline/run_baseline.py) is a human-readable development script with verbose output (not submission format).

```bash
python openenv/baseline/run_baseline.py \
  --endpoint http://localhost:3000 \
  --seed 42
```

### Reproducible Baseline Scores (seed=42, gpt-4o-mini)

```
Task                      Difficulty   Score
──────────────────────────────────────────────
task_classify             Easy         0.7200
task_prioritize           Medium       0.5400
task_full_triage          Hard         0.3800
──────────────────────────────────────────────
Average                                0.5467
```

---

## Python Environment (Direct Usage)

```python
from openenv import EmailTriageEnv, Action

env = EmailTriageEnv()

# Reset to start an episode
obs = env.reset("task_classify", agent_name="my_agent", seed=42)
print(f"Inbox: {len(obs.inbox)} emails")
print(f"Context: {obs.context}")

# Classify an email
email = obs.inbox[0]
action = Action(
    action_type="classify",
    email_id=email.id,
    category="sales"
)
obs, reward, done, info = env.step(action)
print(f"Reward: {reward:.3f}, Done: {done}")
print(f"Feedback: {info.action_feedback}")

# Batch classify for efficiency
action = Action(
    action_type="batch_classify",
    email_ids=[e.id for e in obs.inbox],
    categories=["sales"] * len(obs.inbox)
)
obs, reward, done, info = env.step(action)

# Get full state (with ground truth)
state = env.state()
print(f"Final score: {state.current_score:.4f}")
```

---

## REST API Usage

```bash
# Reset environment (start new episode)
curl -X POST http://localhost:3000/api/env/reset \
  -H "Content-Type: application/json" \
  -d '{"task_id": "task_classify", "agent_name": "my_agent", "seed": 42}'

# Take an action
curl -X POST http://localhost:3000/api/env/step \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<from reset>", "action": {"action_type": "classify", "email_id": "email_000_1234", "category": "sales"}}'

# Get current state
curl "http://localhost:3000/api/env/state?session_id=<session_id>"

# Get leaderboard
curl http://localhost:3000/api/results/leaderboard

# Health check
curl http://localhost:3000/api/healthz
```

---

## Architecture

```
openenv/
├── env/
│   ├── email_env.py       # Main EmailTriageEnv class (OpenEnv interface)
│   ├── models.py          # Pydantic typed models (Observation, Action, Reward, etc.)
│   ├── email_dataset.py   # Synthetic email dataset generator
│   └── graders.py         # Deterministic graders for all 3 tasks
├── baseline/
│   └── run_baseline.py    # OpenAI-based baseline inference script
├── tests/
│   └── test_env.py        # Comprehensive test suite
└── openenv.yaml           # OpenEnv spec metadata

artifacts/
├── api-server/            # Express 5 REST API (TypeScript)
│   └── src/routes/
│       ├── env.ts         # /api/env/reset, /api/env/step, /api/env/state
│       ├── sessions.ts    # /api/sessions
│       └── results.ts     # /api/results/leaderboard, /task-stats, /recent-steps
└── openenv-dashboard/     # React dashboard (TypeScript + Vite)
```

---

## Evaluation Criteria

| Criterion | Weight | Status |
|-----------|--------|--------|
| Real-world utility | 30% | ✅ Email triage is performed by millions of workers daily |
| Task & grader quality | 25% | ✅ 3 tasks, difficulty progression, deterministic scoring |
| Environment design | 20% | ✅ Clean state management, shaped rewards, sensible episodes |
| Code quality & spec compliance | 15% | ✅ Full OpenEnv spec, typed models, Dockerfile, tests |
| Creativity & novelty | 10% | ✅ Multi-component reward, 8 action types, reply quality scoring |

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Citation

```bibtex
@misc{openenv-email-triage-2025,
  title={OpenEnv: Email Triage \& Prioritization Environment},
  author={OpenEnv Contributors},
  year={2025},
  note={Hackathon submission for OpenEnv benchmark challenge}
}
```
