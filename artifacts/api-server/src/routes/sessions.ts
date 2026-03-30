import { Router, type IRouter } from "express";
import { db, sessionsTable, stepRecordsTable } from "@workspace/db";
import { eq, desc, avg, max, count, sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /sessions
router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.startedAt))
    .limit(100);

  res.json(
    sessions.map((s) => ({
      id: s.id,
      task_id: s.taskId,
      agent_name: s.agentName,
      status: s.status,
      step_count: s.stepCount,
      total_reward: s.totalReward,
      final_score: s.finalScore,
      started_at: s.startedAt?.toISOString() ?? null,
      completed_at: s.completedAt?.toISOString() ?? null,
      seed: s.seed,
      accuracy: s.accuracy,
      precision: s.precision,
      recall: s.recall,
    }))
  );
});

// GET /sessions/:id
router.get("/sessions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, raw));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    id: session.id,
    task_id: session.taskId,
    agent_name: session.agentName,
    status: session.status,
    step_count: session.stepCount,
    total_reward: session.totalReward,
    final_score: session.finalScore,
    started_at: session.startedAt?.toISOString() ?? null,
    completed_at: session.completedAt?.toISOString() ?? null,
    seed: session.seed,
    accuracy: session.accuracy,
    precision: session.precision,
    recall: session.recall,
  });
});

export default router;
