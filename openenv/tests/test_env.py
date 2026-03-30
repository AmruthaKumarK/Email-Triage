"""
Tests for the OpenEnv Email Triage Environment.
Run with: python -m pytest openenv/tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from openenv.env import EmailTriageEnv, Action


def test_reset_returns_observation():
    """reset() returns a valid initial observation."""
    env = EmailTriageEnv()
    obs = env.reset("task_classify", "test_agent", seed=42)
    assert obs.inbox is not None
    assert len(obs.inbox) == 10
    assert obs.step_count == 0
    assert obs.time_remaining == 15
    # Agent should NOT see ground-truth labels
    for email in obs.inbox:
        assert email.category is None
        assert email.priority is None


def test_state_after_reset():
    """state() returns the full episode state after reset."""
    env = EmailTriageEnv()
    env.reset("task_classify", "test_agent", seed=42)
    state = env.state()
    assert state.task_id == "task_classify"
    assert state.step_count == 0
    assert state.total_reward == 0.0
    assert not state.done
    assert len(state.emails) == 10


def test_classify_action_rewards():
    """classify action produces reward between -0.2 and 0.5."""
    env = EmailTriageEnv()
    obs = env.reset("task_classify", "test_agent", seed=42)
    first_email = obs.inbox[0]

    action = Action(action_type="classify", email_id=first_email.id, category="sales")
    _, reward, done, info = env.step(action)

    assert isinstance(reward, float)
    assert -0.2 <= reward <= 0.5
    assert info.action_valid is not None
    assert info.emails_processed + info.emails_remaining == 10


def test_episode_terminates():
    """Episode terminates when all emails are processed or max_steps reached."""
    env = EmailTriageEnv()
    obs = env.reset("task_classify", "test_agent", seed=42)

    done = False
    steps = 0
    while not done and steps < 20:
        email = next((e for e in obs.inbox if not e.is_processed), None)
        if email is None:
            break
        action = Action(action_type="classify", email_id=email.id, category="sales")
        obs, reward, done, info = env.step(action)
        steps += 1

    # Should terminate within max_steps=15
    assert steps <= 15


def test_batch_classify():
    """batch_classify processes multiple emails efficiently."""
    env = EmailTriageEnv()
    obs = env.reset("task_classify", "test_agent", seed=42)

    email_ids = [e.id for e in obs.inbox[:5]]
    categories = ["sales"] * 5

    action = Action(
        action_type="batch_classify",
        email_ids=email_ids,
        categories=categories,
    )
    obs, reward, done, info = env.step(action)

    assert isinstance(reward, float)
    assert info.emails_processed == 5


def test_full_triage_task():
    """task_full_triage has 20 emails and max 30 steps."""
    env = EmailTriageEnv()
    obs = env.reset("task_full_triage", "test_agent", seed=42)

    assert len(obs.inbox) == 20
    assert obs.time_remaining == 30


def test_final_score_0_to_1():
    """Final score is always between 0.0 and 1.0."""
    for task_id in ["task_classify", "task_prioritize", "task_full_triage"]:
        env = EmailTriageEnv()
        obs = env.reset(task_id, "test_agent", seed=99)

        done = False
        steps = 0
        max_s = {"task_classify": 15, "task_prioritize": 20, "task_full_triage": 30}[task_id]

        while not done and steps < max_s:
            email = next((e for e in obs.inbox if not e.is_processed), None)
            if email is None:
                break
            action = Action(
                action_type="classify",
                email_id=email.id,
                category="support",
            )
            obs, reward, done, info = env.step(action)
            steps += 1

        final = env.state().current_score
        assert 0.0 <= final <= 1.0, f"Score out of range for {task_id}: {final}"


def test_reward_shaped():
    """Reward function provides signal on each step (not just binary end)."""
    env = EmailTriageEnv()
    obs = env.reset("task_classify", "test_agent", seed=42)

    rewards = []
    for email in obs.inbox[:5]:
        action = Action(action_type="classify", email_id=email.id, category="executive")
        obs, reward, done, info = env.step(action)
        rewards.append(reward)

    # Should have varying reward signals (shaped, not all zeros)
    assert not all(r == 0 for r in rewards)


def test_penalty_for_invalid_actions():
    """Invalid actions receive negative reward."""
    env = EmailTriageEnv()
    env.reset("task_classify", "test_agent", seed=42)

    action = Action(action_type="classify", email_id="nonexistent_id_xyz", category="sales")
    _, reward, _, info = env.step(action)

    assert reward < 0
    assert info.penalty_applied


def test_reproducibility():
    """Same seed produces same email dataset."""
    env1 = EmailTriageEnv()
    env2 = EmailTriageEnv()
    obs1 = env1.reset("task_classify", "agent_a", seed=42)
    obs2 = env2.reset("task_classify", "agent_b", seed=42)

    subjects1 = [e.subject for e in obs1.inbox]
    subjects2 = [e.subject for e in obs2.inbox]
    assert subjects1 == subjects2
