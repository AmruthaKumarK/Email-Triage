import React from "react";
import { motion } from "framer-motion";
import { Terminal, ArrowRight, ShieldCheck, Zap, Database } from "lucide-react";

export function Hero() {
  const scrollToEnv = () => {
    document.getElementById('live-environment')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative w-full rounded-[2.5rem] overflow-hidden mb-12 border border-white/10 shadow-2xl group">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-bg.png)` }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-8 md:p-16 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md"
        >
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-xs font-semibold tracking-widest uppercase text-white/80">OpenEnv v1.0 Live</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-display font-extrabold text-white leading-tight mb-6"
        >
          Email Triage <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">AI Benchmark.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-white/70 mb-10 max-w-2xl leading-relaxed font-medium"
        >
          A real-world environment for training and evaluating autonomous agents. 
          Agents must categorize, prioritize, and draft replies to a chaotic inbox, earning partial credit across complex trajectories.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center gap-4"
        >
          <button 
            onClick={scrollToEnv}
            className="px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold flex items-center gap-2 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all transform hover:-translate-y-1"
          >
            <Terminal className="w-5 h-5" /> Run Baseline Agent
          </button>
          <button className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold flex items-center gap-2 backdrop-blur-md transition-all">
            View Documentation <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Feature badges */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 flex flex-wrap gap-6 border-t border-white/10 pt-8"
        >
          <Feature icon={<ShieldCheck />} text="Deterministic Graders" />
          <Feature icon={<Zap />} text="Trajectory Rewards" />
          <Feature icon={<Database />} text="Real-world Data Distribution" />
        </motion.div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: any) {
  return (
    <div className="flex items-center gap-2 text-white/60 font-medium text-sm">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}
