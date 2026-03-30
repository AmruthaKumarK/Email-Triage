import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  agentName: text("agent_name").notNull(),
  status: text("status").notNull().default("active"),
  stepCount: integer("step_count").notNull().default(0),
  totalReward: real("total_reward").notNull().default(0),
  finalScore: real("final_score"),
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  seed: integer("seed"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  stateJson: jsonb("state_json"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ startedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const stepRecordsTable = pgTable("step_records", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id),
  stepNumber: integer("step_number").notNull(),
  actionType: text("action_type").notNull(),
  actionJson: jsonb("action_json"),
  reward: real("reward").notNull().default(0),
  cumulativeReward: real("cumulative_reward").notNull().default(0),
  infoJson: jsonb("info_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStepRecordSchema = createInsertSchema(stepRecordsTable).omit({ id: true, createdAt: true });
export type InsertStepRecord = z.infer<typeof insertStepRecordSchema>;
export type StepRecord = typeof stepRecordsTable.$inferSelect;
