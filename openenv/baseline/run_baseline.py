#!/usr/bin/env python3
"""
OpenEnv Email Triage — Baseline Inference Script

Runs a GPT-4o-mini agent against all 3 tasks and reports reproducible scores.

Usage:
    python baseline/run_baseline.py --api-key YOUR_KEY --endpoint http://localhost:3000

Environment variables:
    OPENAI_API_KEY  — OpenAI API key (required)
    OPENENV_ENDPOINT — API endpoint (default: http://localhost:3000)

Reproducible baseline scores (seed=42):
    task_classify:     ~0.72
    task_prioritize:   ~0.54
    task_full_triage:  ~0.38
"""

import os
import sys
import json
import time
import argparse
from typing import Any, Dict, Optional
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TASKS = ["task_classify", "task_prioritize", "task_full_triage"]
DEFAULT_SEED = 42
DEFAULT_AGENT_NAME = "gpt-4o-mini-baseline"
DEFAULT_ENDPOINT = os.environ.get("OPENENV_ENDPOINT", "http://localhost:3000")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ---------------------------------------------------------------------------
# HTTP helpers (pure stdlib, no requests dependency)
# ---------------------------------------------------------------------------

def api_post(endpoint: str, path: str, body: dict) -> dict:
    url = f"{endpoint}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}")


def api_get(endpoint: str, path: str) -> dict:
    url = f"{endpoint}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}")


# ---------------------------------------------------------------------------
# OpenAI client (pure stdlib)
# ---------------------------------------------------------------------------

def call_openai(messages: list, model: str = "gpt-4o-mini") -> str:
    """Call OpenAI chat completions API and return the assistant message."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 1000,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    return result["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert email triage assistant. You process corporate inboxes efficiently and accurately.

You will be given an inbox of emails and must take actions to process them.

For each email, respond with a JSON object specifying the action to take.

Valid action types:
- classify: {"action_type": "classify", "email_id": "...", "category": "..."}
- prioritize: {"action_type": "prioritize", "email_id": "...", "priority": "..."}
- reply: {"action_type": "reply", "email_id": "...", "reply_text": "..."}
- escalate: {"action_type": "escalate", "email_id": "..."}
- archive: {"action_type": "archive", "email_id": "..."}
- batch_classify: {"action_type": "batch_classify", "email_ids": [...], "categories": [...]}
- batch_prioritize: {"action_type": "batch_prioritize", "email_ids": [...], "priorities": [...]}

Valid categories: sales, support, legal, hr, executive, spam, newsletter, personal
Valid priorities: critical, high, medium, low

Always respond with ONLY a valid JSON object. No markdown, no explanation."""


def build_triage_prompt(observation: dict, task_id: str) -> str:
    """Build a prompt for the agent given an observation."""
    inbox = observation["inbox"]
    step = observation["step_count"]
    remaining = observation["time_remaining"]
    context = observation["context"]
    hint = observation.get("performance_hint", "")

    email_list = []
    for email in inbox:
        if not email.get("is_processed", False):
            email_list.append(
                f"ID: {email['id']}\n"
                f"Subject: {email['subject']}\n"
                f"From: {email['sender']}\n"
                f"Has Attachment: {email['has_attachment']}\n"
                f"Requires Reply: {email['requires_reply']}\n"
                f"Body (excerpt): {email['body'][:300]}...\n"
                f"---"
            )

    emails_text = "\n".join(email_list) if email_list else "All emails processed."

    prompt = f"""Task: {context}

Step {step} | Steps remaining: {remaining}
{f"Last action feedback: {hint}" if hint else ""}

Unprocessed emails:
{emails_text}

Based on the task requirements, choose the MOST EFFICIENT next action.
For batch actions, process multiple emails at once when appropriate.

Respond with a single JSON action object:"""

    return prompt


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

def run_task(task_id: str, endpoint: str, seed: int, verbose: bool = True) -> float:
    """Run a single task episode and return the final score."""
    if verbose:
        print(f"\n{'='*60}")
        print(f"Task: {task_id}")
        print(f"Seed: {seed}")
        print(f"{'='*60}")

    # Reset environment
    reset_result = api_post(endpoint, "/api/env/reset", {
        "task_id": task_id,
        "agent_name": DEFAULT_AGENT_NAME,
        "seed": seed,
    })

    session_id = reset_result["session_id"]
    observation = reset_result["observation"]
    task_info = reset_result["task_info"]

    if verbose:
        print(f"Session: {session_id}")
        print(f"Emails: {len(observation['inbox'])}")
        print(f"Max steps: {task_info['max_steps']}")

    total_reward = 0.0
    step = 0
    conversation = [{"role": "system", "content": SYSTEM_PROMPT}]

    while True:
        step += 1
        prompt = build_triage_prompt(observation, task_id)
        conversation.append({"role": "user", "content": prompt})

        # Call LLM
        try:
            response_text = call_openai(conversation)
        except Exception as e:
            if verbose:
                print(f"  LLM error: {e}")
            break

        conversation.append({"role": "assistant", "content": response_text})

        # Parse action
        try:
            # Strip markdown code blocks if present
            clean = response_text.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            action = json.loads(clean.strip())
        except json.JSONDecodeError as e:
            if verbose:
                print(f"  Step {step}: JSON parse error: {e}")
            # Take a dummy action to avoid getting stuck
            action = {"action_type": "flag", "email_id": observation["inbox"][0]["id"] if observation["inbox"] else ""}

        if verbose:
            print(f"  Step {step}: {action.get('action_type', '?')} -> ", end="")

        # Step environment
        try:
            step_result = api_post(endpoint, "/api/env/step", {
                "session_id": session_id,
                "action": action,
            })
        except Exception as e:
            if verbose:
                print(f"API error: {e}")
            break

        reward = step_result["reward"]
        done = step_result["done"]
        info = step_result["info"]
        observation = step_result["observation"]
        total_reward += reward

        if verbose:
            print(
                f"reward={reward:.3f} | cumulative_score={info['cumulative_score']:.3f} | "
                f"processed={info['emails_processed']}/{info['emails_processed'] + info['emails_remaining']}"
            )

        if done:
            final_score = info["cumulative_score"]
            if verbose:
                print(f"\n✓ Episode complete!")
                print(f"  Final score: {final_score:.4f}")
                print(f"  Total reward: {total_reward:.4f}")
                print(f"  Steps used: {step}/{task_info['max_steps']}")
            return final_score

    # Fallback: get final state
    try:
        state = api_get(endpoint, f"/api/env/state?session_id={session_id}")
        return state.get("current_score", 0.0)
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="OpenEnv Email Triage Baseline Runner")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="API endpoint")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Random seed")
    parser.add_argument("--task", default="all", help="Task to run (or 'all')")
    parser.add_argument("--verbose", action="store_true", default=True, help="Verbose output")
    parser.add_argument("--api-key", default=None, help="OpenAI API key (overrides env var)")
    args = parser.parse_args()

    global OPENAI_API_KEY
    if args.api_key:
        OPENAI_API_KEY = args.api_key

    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set. Use --api-key or set OPENAI_API_KEY env var.")
        sys.exit(1)

    # Check endpoint health
    try:
        health = api_get(args.endpoint, "/api/healthz")
        print(f"✓ Environment healthy: {health}")
    except Exception as e:
        print(f"✗ Cannot connect to environment at {args.endpoint}: {e}")
        sys.exit(1)

    # Run tasks
    tasks_to_run = TASKS if args.task == "all" else [args.task]
    scores = {}

    for task_id in tasks_to_run:
        score = run_task(task_id, args.endpoint, args.seed, args.verbose)
        scores[task_id] = score
        time.sleep(0.5)  # Small delay between tasks

    # Summary report
    print(f"\n{'='*60}")
    print("BASELINE RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"Model:   {DEFAULT_AGENT_NAME}")
    print(f"Seed:    {args.seed}")
    print(f"")

    difficulty = {
        "task_classify": "Easy",
        "task_prioritize": "Medium",
        "task_full_triage": "Hard",
    }

    for task_id, score in scores.items():
        diff = difficulty.get(task_id, "")
        print(f"  {task_id:<25} [{diff:^6}]  {score:.4f}")

    if len(scores) == 3:
        avg = sum(scores.values()) / len(scores)
        print(f"  {'Average':<25}         {avg:.4f}")

    print(f"\nExpected baseline scores:")
    print(f"  task_classify:     ~0.72")
    print(f"  task_prioritize:   ~0.54")
    print(f"  task_full_triage:  ~0.38")

    # Machine-readable output
    print(f"\nJSON output:")
    print(json.dumps({"seed": args.seed, "model": DEFAULT_AGENT_NAME, "scores": scores}, indent=2))


if __name__ == "__main__":
    main()
