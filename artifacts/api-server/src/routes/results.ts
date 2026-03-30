import { Router, type IRouter } from "express";
import { db, sessionsTable, stepRecordsTable } from "@workspace/db";
import { eq, desc, avg, max, count, sql } from "drizzle-orm";

const router: IRouter = Router();

const TASK_META: Record<string, { name: string; difficulty: string }> = {
  task_classify: { name: "Email Classification", difficulty: "easy" },
  task_prioritize: { name: "Priority Ranking", difficulty: "medium" },
  task_full_triage: { name: "Full Triage Pipeline", difficulty: "hard" },
};

// GET /results/leaderboard
router.get("/results/leaderboard", async (_req, res): Promise<void> => {
  const results = await db
    .select({
      agent_name: sessionsTable.agentName,
      task_id: sessionsTable.taskId,
      score: max(sessionsTable.finalScore),
      sessions_count: count(sessionsTable.id),
      avg_steps: avg(sessionsTable.stepCount),
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.status, "completed"))
    .groupBy(sessionsTable.agentName, sessionsTable.taskId)
    .orderBy(desc(max(sessionsTable.finalScore)))
    .limit(50);

  const leaderboard = results.map((r, i) => ({
    rank: i + 1,
    agent_name: r.agent_name,
    task_id: r.task_id,
    score: r.score ?? 0,
    sessions_count: Number(r.sessions_count),
    avg_steps: Number(r.avg_steps ?? 0),
  }));

  res.json(leaderboard);
});

// GET /results/task-stats
router.get("/results/task-stats", async (_req, res): Promise<void> => {
  const taskIds = ["task_classify", "task_prioritize", "task_full_triage"];
  const stats = [];

  for (const taskId of taskIds) {
    const [result] = await db
      .select({
        total_runs: count(sessionsTable.id),
        avg_score: avg(sessionsTable.finalScore),
        best_score: max(sessionsTable.finalScore),
        avg_steps: avg(sessionsTable.stepCount),
        completed: count(
          sql`CASE WHEN ${sessionsTable.status} = 'completed' THEN 1 END`
        ),
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.taskId, taskId));

    const meta = TASK_META[taskId];
    const totalRuns = Number(result?.total_runs ?? 0);
    const completed = Number(result?.completed ?? 0);

    stats.push({
      task_id: taskId,
      task_name: meta.name,
      difficulty: meta.difficulty,
      total_runs: totalRuns,
      avg_score: Number(result?.avg_score ?? 0),
      best_score: Number(result?.best_score ?? 0),
      avg_steps: Number(result?.avg_steps ?? 0),
      completion_rate: totalRuns > 0 ? completed / totalRuns : 0,
    });
  }

  res.json(stats);
});

// GET /results/recent-steps
router.get("/results/recent-steps", async (req, res): Promise<void> => {
  const limitRaw = req.query.limit;
  const limit = limitRaw ? parseInt(String(limitRaw), 10) : 20;

  const steps = await db
    .select()
    .from(stepRecordsTable)
    .orderBy(desc(stepRecordsTable.createdAt))
    .limit(Math.min(limit, 100));

  res.json(
    steps.map((s) => ({
      id: s.id,
      session_id: s.sessionId,
      step_number: s.stepNumber,
      action_type: s.actionType,
      reward: s.reward,
      cumulative_reward: s.cumulativeReward,
      created_at: s.createdAt?.toISOString() ?? null,
    }))
  );
});

export default router;
