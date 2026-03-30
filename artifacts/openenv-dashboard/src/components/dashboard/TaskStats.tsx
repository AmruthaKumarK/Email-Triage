import React from "react";
import { useGetTaskStats } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3, PieChart } from "lucide-react";
import { motion } from "framer-motion";

export function TaskStats() {
  const { data: stats, isLoading } = useGetTaskStats();

  if (isLoading) {
    return <div className="h-64 glass-panel rounded-2xl flex items-center justify-center animate-pulse bg-white/5"></div>;
  }

  if (!stats || stats.length === 0) return null;

  const chartData = stats.map(s => ({
    name: s.task_name,
    score: s.avg_score * 100,
    completion: s.completion_rate * 100
  }));

  const colors = ['#3b82f6', '#06b6d4', '#8b5cf6'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cards */}
      <div className="space-y-4">
        <h3 className="text-xl font-display font-bold flex items-center gap-2 mb-6">
          <PieChart className="text-accent w-5 h-5" /> Task Performance
        </h3>
        {stats.map((stat, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={stat.task_id} 
            className="glass-card p-5 rounded-2xl"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-white">{stat.task_name}</h4>
              <span className={`text-xs px-2 py-1 rounded-md border font-semibold uppercase tracking-wider
                ${stat.difficulty === 'easy' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                  stat.difficulty === 'medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                  'border-red-500/30 text-red-400 bg-red-500/10'}`
              }>
                {stat.difficulty}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Avg Score</div>
                <div className="text-lg font-bold text-white">{(stat.avg_score * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Completion</div>
                <div className="text-lg font-bold text-white">{(stat.completion_rate * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Runs</div>
                <div className="text-lg font-bold text-white">{stat.total_runs}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col">
        <h3 className="text-xl font-display font-bold flex items-center gap-2 mb-8">
          <BarChart3 className="text-primary w-5 h-5" /> Average Score by Task
        </h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                contentStyle={{ backgroundColor: 'rgba(10,10,12,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
