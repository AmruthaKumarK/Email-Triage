"""Typed Pydantic models for the OpenEnv Email Triage Environment."""
from __future__ import annotations
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


VALID_CATEGORIES = Literal["sales", "support", "legal", "hr", "executive", "spam", "newsletter", "personal"]
VALID_PRIORITIES = Literal["critical", "high", "medium", "low"]
ACTION_TYPES = Literal[
    "classify", "prioritize", "reply", "archive", "escalate",
    "flag", "batch_classify", "batch_prioritize"
]


class Email(BaseModel):
    """A single email in the inbox."""
    id: str
    subject: str
    sender: str
    sender_domain: str
    body: str
    timestamp: str
    category: Optional[str] = None          # Ground truth (hidden from agent)
    priority: Optional[str] = None          # Ground truth (hidden from agent)
    has_attachment: bool = False
    thread_id: Optional[str] = None
    requires_reply: bool = False
    is_processed: bool = False

    def to_agent_view(self) -> "Email":
        """Return a copy without ground-truth labels."""
        return self.model_copy(update={"category": None, "priority": None})


class Observation(BaseModel):
    """What the agent sees after reset or step."""
    inbox: List[Email] = Field(description="Current inbox emails (without ground truth labels)")
    step_count: int = Field(description="Current step number")
    time_remaining: int = Field(description="Steps remaining in episode")
    context: str = Field(description="Task context and instructions")
    performance_hint: Optional[str] = Field(None, description="Feedback on previous action")


class Action(BaseModel):
    """An action the agent can take."""
    action_type: str = Field(description="Type of action to perform")
    email_id: Optional[str] = Field(None, description="Target email ID")
    email_ids: Optional[List[str]] = Field(None, description="Target email IDs for batch")
    category: Optional[str] = Field(None, description="Category label")
    priority: Optional[str] = Field(None, description="Priority label")
    reply_text: Optional[str] = Field(None, description="Draft reply text")
    categories: Optional[List[str]] = Field(None, description="Categories for batch")
    priorities: Optional[List[str]] = Field(None, description="Priorities for batch")


class Reward(BaseModel):
    """Reward signal from a step."""
    value: float = Field(ge=0.0, le=1.0, description="Normalized reward for this step")
    components: dict = Field(default_factory=dict, description="Reward breakdown by component")
    penalty: float = Field(default=0.0, description="Any penalty applied")
    reason: str = Field(default="", description="Human-readable explanation")


class TaskInfo(BaseModel):
    """Metadata about the current task."""
    task_id: str
    name: str
    description: str
    difficulty: str
    max_steps: int
    scoring_criteria: List[str]


class StepInfo(BaseModel):
    """Additional info returned with each step."""
    action_valid: bool
    action_feedback: str
    partial_score: float
    cumulative_score: float
    emails_processed: int
    emails_remaining: int
    penalty_applied: bool


class EpisodeState(BaseModel):
    """Full internal state of an episode."""
    session_id: str
    task_id: str
    agent_name: str
    step_count: int = 0
    total_reward: float = 0.0
    done: bool = False
    emails: List[Email] = Field(default_factory=list)
    actions_taken: List[Action] = Field(default_factory=list)
    classified: dict = Field(default_factory=dict)   # email_id -> category
    prioritized: dict = Field(default_factory=dict)  # email_id -> priority
    replied: dict = Field(default_factory=dict)      # email_id -> reply_text
    archived: List[str] = Field(default_factory=list)
    escalated: List[str] = Field(default_factory=list)
    current_score: float = 0.0
