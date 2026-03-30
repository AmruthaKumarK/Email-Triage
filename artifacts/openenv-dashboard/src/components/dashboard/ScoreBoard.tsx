import React from "react";
import { Trophy, Target, Zap, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { StateResponse } from "@workspace/api-client-react/src/generated/api.schemas";

export function ScoreBoard({ state }: { state: StateResponse }) {
  const maxSteps = state.task_id === "task_full_triage" ? 30 : 20; // Example thresholds
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <ScoreCard 
        icon={<Trophy className="h-5 w-5 text-primary" />}
        label="Current Score"
        value={(state.current_score || 0).toFixed(2)}
        accent="border-primary/50"
      />
      <ScoreCard 
        icon={<Target className="h-5 w-5 text-accent" />}
        label="Total Reward"
        value={(state.total_reward || 0).toFixed(2)}
        accent="border-accent/50"
      />
      <ScoreCard 
        icon={<Zap className="h-5 w-5 text-yellow-500" />}
        label="Actions Taken"
        value={state.step_count.toString()}
        subtext={`/ ${maxSteps} max`}
        accent="border-yellow-500/50"
      />
      <ScoreCard 
        icon={<Clock className="h-5 w-5 text-purple-500" />}
        label="Status"
        value={state.done ? "Completed" : "Active"}
        valueClass={state.done ? "text-green-400" : "text-purple-400"}
        accent="border-purple-500/50"
      />
    </div>
  );
}

function ScoreCard({ icon, label, value, subtext, accent, valueClass }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel p-5 border-t-2 ${accent} rounded-2xl flex flex-col justify-center`}
    >
      <div className="flex items-center gap-3 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-display font-bold ${valueClass || 'text-foreground'}`}>
          {value}
        </span>
        {subtext && <span className="text-sm text-muted-foreground font-medium">{subtext}</span>}
      </div>
    </motion.div>
  );
}
