import React from "react";
import { Layers } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            Open<span className="text-primary">Env</span>
          </span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <a href="#" className="hover:text-white transition-colors">Environment</a>
          <a href="#" className="hover:text-white transition-colors">Leaderboard</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
          <a href="https://huggingface.co/spaces/openenv" target="_blank" rel="noreferrer" className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all">
            HF Space
          </a>
        </nav>
      </div>
    </header>
  );
}
