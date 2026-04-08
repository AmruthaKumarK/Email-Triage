#!/usr/bin/env python3
"""
OpenEnv Email Triage — Inference Script
========================================

Mandatory environment variables:
    API_BASE_URL        The API endpoint for the LLM (base URL for OpenAI-compatible API)
    MODEL_NAME          The model identifier to use for inference
    HF_TOKEN            Your Hugging Face / API key
    LOCAL_IMAGE_NAME    (optional) local Docker image name if using from_docker_image()

Defaults:
    API_BASE_URL = os.getenv("API_BASE_URL", "https://api.openai.com/v1")
    MODEL_NAME   = os.getenv("MODEL_NAME", "gpt-4o-mini")

STDOUT format (exactly three line types per episode):
    [START] task=<task_name> env=email-triage model=<model_name>
    [STEP]  step=<n> action=<action_str> reward=<0.00> done=<true|false> error=<msg|null>
    [END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...>
"""

import os
import sys
import json
import urllib.request
import urllib.error

from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration — mandatory env vars per spec
# ---------------------------------------------------------------------------

API_BASE_URL = os.getenv("API_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME   = os.getenv("MODEL_NAME", "gpt-4o-mini")
HF_TOKEN     = os.getenv("HF_TOKEN", "")

OPENENV_ENDPOINT = os.getenv("OPENENV_ENDPOINT", "http://localhost:3000")
SEED             = int(os.getenv("SEED", "42"))
AGENT_NAME       = os.getenv("AGENT_NAME", MODEL_NAME)

TASKS = ["task_classify", "task_prioritize", "task_full_triage"]

# ---------------------------------------------------------------------------
# OpenAI client — uses API_BASE_URL and HF_TOKEN per spec
# ---------------------------------------------------------------------------

client = OpenAI(
    base_url=API_BASE_URL,
    api_key=HF_TOKEN if HF_TOKEN else "placeholder",
)

# ---------------------------------------------------------------------------
# HTTP helpers for OpenEnv REST API (stdlib only)
# ---------------------------------------------------------------------------

def _post(path: str, body: dict) -> dict:
    url = f"{OPENENV_ENDPOINT.rstrip('/')}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {url}: {e.read().decode()}")


def _get(path: str) -> dict:
    url = f"{OPENENV_ENDPOINT.rstrip('/')}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {url}: {e.read().decode()}")

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert email triage assistant. Process corporate inboxes efficiently.

Valid action types (respond with ONE JSON object only, no markdown):
  classify:          {"action_type": "classify", "email_id": "...", "category": "..."}
  prioritize:        {"action_type": "prioritize", "email_id": "...", "priority": "..."}
  reply:             {"action_type": "reply", "email_id": "...", "reply_text": "..."}
  escalate:          {"action_type": "escalate", "email_id": "..."}
  archive:           {"action_type": "archive", "email_id": "..."}
  batch_classify:    {"action_type": "batch_classify", "email_ids": [...], "categories": [...]}
  batch_prioritize:  {"action_type": "batch_prioritize", "email_ids": [...], "priorities": [...]}

Valid categories: sales, support, legal, hr, executive, spam, newsletter, personal
Valid priorities: critical, high, medium, low

Respond with ONLY a valid JSON object. No markdown, no explanation."""


def _build_prompt(observation: dict) -> str:
    inbox = observation.get("inbox", [])
    step  = observation.get("step_count", 0)
    remaining = observation.get("time_remaining", "?")
    context   = observation.get("context", "")
    hint      = observation.get("performance_hint", "")

    unprocessed = [
        f"ID: {e['id']}\nSubject: {e['subject']}\nFrom: {e['sender']}\n"
        f"HasAttachment: {e['has_attachment']} | RequiresReply: {e['requires_reply']}\n"
        f"Body: {e['body'][:300]}...\n---"
        for e in inbox if not e.get("is_processed", False)
    ]
    emails_text = "\n".join(unprocessed) if unprocessed else "All emails processed."

    return (
        f"Task: {context}\n"
        f"Step {step} | Steps remaining: {remaining}\n"
        + (f"Last feedback: {hint}\n" if hint else "")
        + f"\nUnprocessed emails:\n{emails_text}\n\n"
        "Choose the most efficient single action. Use batch actions when possible.\n"
        "Respond with ONE JSON action object:"
    )

# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def _call_llm(messages: list) -> str:
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        temperature=0,
        max_tokens=512,
    )
    return response.choices[0].message.content or ""

# ---------------------------------------------------------------------------
# Parse LLM output into an action dict
# ---------------------------------------------------------------------------

def _parse_action(text: str, fallback_email_id: str) -> dict:
    clean = text.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1] if len(parts) > 1 else clean
        if clean.startswith("json"):
            clean = clean[4:]
    try:
        return json.loads(clean.strip())
    except json.JSONDecodeError:
        return {"action_type": "archive", "email_id": fallback_email_id}

# ---------------------------------------------------------------------------
# Single-task episode runner
# ---------------------------------------------------------------------------

def run_episode(task_id: str) -> None:
    """
    Run one episode for the given task and emit [START]/[STEP]/[END] lines to stdout.
    """
    rewards: list[float] = []
    steps   = 0
    score   = 0.0
    success = False
    session_id = None

    # --- [START] ---
    print(f"[START] task={task_id} env=email-triage model={MODEL_NAME}", flush=True)

    try:
        # Reset
        reset = _post("/reset", {
            "task_id":    task_id,
            "agent_name": AGENT_NAME,
            "seed":       SEED,
        })
        session_id  = reset["session_id"]
        observation = reset["observation"]
        task_info   = reset["task_info"]

        conversation = [{"role": "system", "content": SYSTEM_PROMPT}]

        while True:
            steps += 1
            prompt = _build_prompt(observation)
            conversation.append({"role": "user", "content": prompt})

            # LLM
            error_str = None
            try:
                llm_out = _call_llm(conversation)
                conversation.append({"role": "assistant", "content": llm_out})
            except Exception as exc:
                error_str = str(exc).replace("\n", " ")
                llm_out   = ""

            # Determine fallback email id
            inbox = observation.get("inbox", [])
            unprocessed = [e for e in inbox if not e.get("is_processed", False)]
            fallback_id = unprocessed[0]["id"] if unprocessed else (inbox[0]["id"] if inbox else "")

            action = _parse_action(llm_out, fallback_id) if llm_out else {
                "action_type": "archive", "email_id": fallback_id
            }
            action_str = json.dumps(action, separators=(",", ":"))

            # Step
            try:
                step_result = _post("/step", {
                    "session_id": session_id,
                    "action":     action,
                })
                reward      = float(step_result["reward"])
                done        = bool(step_result["done"])
                info        = step_result.get("info", {})
                observation = step_result["observation"]
                score       = float(info.get("cumulative_score", 0.0))

                if not error_str:
                    step_error = info.get("action_feedback", None)
                    # Only treat as error if it signals a failure
                    if step_error and "invalid" in step_error.lower():
                        error_str = step_error.replace("\n", " ")

            except Exception as exc:
                reward    = 0.0
                done      = True
                error_str = str(exc).replace("\n", " ")

            rewards.append(reward)
            error_out = error_str if error_str else "null"
            done_str  = "true" if done else "false"

            # --- [STEP] ---
            print(
                f"[STEP] step={steps} action={action_str} "
                f"reward={reward:.2f} done={done_str} error={error_out}",
                flush=True,
            )

            if done:
                success = score >= 0.5
                break

            if steps >= task_info.get("max_steps", 30):
                success = score >= 0.5
                break

    except Exception as exc:
        error_line = str(exc).replace("\n", " ")
        rewards.append(0.0)
        print(
            f"[STEP] step={max(steps,1)} action=null "
            f"reward=0.00 done=true error={error_line}",
            flush=True,
        )

    # --- [END] ---
    rewards_str = ",".join(f"{r:.2f}" for r in rewards)
    print(
        f"[END] success={'true' if success else 'false'} "
        f"steps={steps} score={score:.2f} rewards={rewards_str}",
        flush=True,
    )

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not HF_TOKEN:
        print(
            "WARNING: HF_TOKEN is not set. "
            "Set HF_TOKEN to your API key (OpenAI key or HF token).",
            file=sys.stderr,
        )

    # Verify environment is reachable
    try:
        _get("/healthz")
    except Exception as exc:
        print(f"ERROR: Cannot reach OpenEnv API at {OPENENV_ENDPOINT}: {exc}", file=sys.stderr)
        sys.exit(1)

    # Run all tasks (one episode each)
    task_arg = os.getenv("TASK", "all")
    tasks = TASKS if task_arg == "all" else [task_arg]

    for task_id in tasks:
        run_episode(task_id)


if __name__ == "__main__":
    main()
