import React from "react";
import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/dashboard/Hero";
import { LiveEnvironment } from "@/components/dashboard/LiveEnvironment";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { TaskStats } from "@/components/dashboard/TaskStats";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-20">
        <section>
          <Hero />
        </section>

        <section>
          <LiveEnvironment />
        </section>

        <section className="grid grid-cols-1 gap-12">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-display font-bold text-white">Benchmark Results</h2>
              <p className="text-muted-foreground mt-2">Aggregate performance across all evaluated agents.</p>
            </div>
            <TaskStats />
          </div>
          
          <div className="pt-8">
            <Leaderboard />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 mt-20 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          System Operational
        </div>
        <p className="mt-4 text-xs opacity-60">OpenEnv AI Agent Benchmark © 2025</p>
      </footer>
    </div>
  );
}
