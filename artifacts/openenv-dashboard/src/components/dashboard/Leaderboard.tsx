import React from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Medal, Award, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  if (isLoading) {
    return <div className="h-64 glass-panel rounded-2xl flex items-center justify-center animate-pulse bg-white/5"></div>;
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="h-64 glass-panel rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
        <Activity className="w-10 h-10 mb-4 opacity-50" />
        <p>No benchmark results available yet.</p>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch(rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2: return <Medal className="w-5 h-5 text-gray-300" />;
      case 3: return <Award className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-white/40 font-bold w-5 text-center">{rank}</span>;
    }
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
      <div className="p-6 border-b border-white/5 bg-white/[0.02]">
        <h3 className="text-xl font-display font-bold flex items-center gap-2">
          <Trophy className="text-primary w-5 h-5" /> Global Leaderboard
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/40 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="p-4 pl-6 w-16">Rank</th>
              <th className="p-4">Agent Name</th>
              <th className="p-4">Task</th>
              <th className="p-4">Score</th>
              <th className="p-4">Avg Steps</th>
              <th className="p-4 pr-6">Runs</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, idx) => (
              <motion.tr 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={`${entry.agent_name}-${entry.task_id}`} 
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="p-4 pl-6 font-display font-bold">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10">
                    {getRankIcon(entry.rank)}
                  </div>
                </td>
                <td className="p-4 font-semibold text-white">
                  {entry.agent_name}
                </td>
                <td className="p-4">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/80">
                    {entry.task_id.replace('task_', '').toUpperCase()}
                  </span>
                </td>
                <td className="p-4 font-display font-bold text-primary">
                  {(entry.score * 100).toFixed(1)}%
                </td>
                <td className="p-4 text-muted-foreground text-sm">
                  {entry.avg_steps.toFixed(1)}
                </td>
                <td className="p-4 pr-6 text-muted-foreground text-sm">
                  {entry.sessions_count}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
