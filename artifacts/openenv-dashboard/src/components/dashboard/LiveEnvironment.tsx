import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveSession } from "@/hooks/use-live-session";
import { ScoreBoard } from "./ScoreBoard";
import { EmailActionPanel } from "./EmailActionPanel";
import { Mail, CheckCircle2, Play, RefreshCw, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function LiveEnvironment() {
  const { 
    sessionId, 
    activeTaskId, 
    setActiveTaskId,
    agentName,
    setAgentName,
    selectedEmailId, 
    setSelectedEmailId, 
    envState, 
    isLoadingState,
    isResetting,
    isStepping,
    startSession,
    takeAction
  } = useLiveSession();

  // Auto-select first unread email if none selected
  useEffect(() => {
    if (envState?.emails && !selectedEmailId) {
      const firstUnprocessed = envState.emails.find(e => !e.is_processed);
      if (firstUnprocessed) setSelectedEmailId(firstUnprocessed.id);
      else if (envState.emails.length > 0) setSelectedEmailId(envState.emails[0].id);
    }
  }, [envState?.emails, selectedEmailId]);

  const activeEmail = envState?.emails.find(e => e.id === selectedEmailId);

  return (
    <div className="w-full space-y-6" id="live-environment">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <span className="bg-primary/20 text-primary p-2 rounded-xl border border-primary/30">
              <Play className="w-6 h-6" />
            </span>
            Live Benchmark Runner
          </h2>
          <p className="text-muted-foreground mt-2 font-medium">Execute an agent trajectory interactively.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto bg-black/30 p-2 rounded-2xl border border-white/5">
          <select 
            value={activeTaskId}
            onChange={(e) => setActiveTaskId(e.target.value)}
            disabled={!!sessionId && !envState?.done}
            className="bg-transparent border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-primary transition-all disabled:opacity-50"
          >
            <option value="task_classify">Task 1: Classification</option>
            <option value="task_prioritize">Task 2: Prioritization</option>
            <option value="task_full_triage">Task 3: Full Triage</option>
          </select>
          
          <input 
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            disabled={!!sessionId && !envState?.done}
            placeholder="Agent Name"
            className="bg-transparent border border-white/10 rounded-xl px-4 py-2.5 w-40 text-sm font-medium focus:outline-none focus:border-primary transition-all disabled:opacity-50"
          />

          <button
            onClick={startSession}
            disabled={isResetting}
            className="bg-white text-black hover:bg-white/90 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
          >
            {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {sessionId && !envState?.done ? "Restart Episode" : "Start Episode"}
          </button>
        </div>
      </div>

      {!sessionId && !isResetting && (
        <div className="glass-panel p-12 text-center rounded-3xl border-dashed border-2 border-white/10">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-primary opacity-80" />
          </div>
          <h3 className="text-2xl font-bold mb-2 text-white">Environment Idle</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Select a task difficulty and click "Start Episode" to initialize the OpenEnv backend and receive the first observation.
          </p>
          <button
            onClick={startSession}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all transform hover:-translate-y-1"
          >
            Initialize Now
          </button>
        </div>
      )}

      {isLoadingState && sessionId && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {envState && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <ScoreBoard state={envState} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
            {/* Inbox Sidebar */}
            <div className="lg:col-span-4 glass-panel rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Active Inbox</h3>
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-md">
                  {envState.emails.filter(e => !e.is_processed).length} Left
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <AnimatePresence>
                  {envState.emails.map((email) => (
                    <motion.div
                      key={email.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setSelectedEmailId(email.id)}
                      className={cn(
                        "cursor-pointer p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                        selectedEmailId === email.id 
                          ? "bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]",
                        email.is_processed && "opacity-60"
                      )}
                    >
                      {selectedEmailId === email.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm truncate pr-2 text-white/90 group-hover:text-primary transition-colors">
                          {email.sender}
                        </span>
                        {email.is_processed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                      </div>
                      <h4 className="text-sm font-medium truncate text-white mb-1">{email.subject}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {email.body}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Email Detail & Action Panel */}
            <div className="lg:col-span-8 h-full">
              {activeEmail ? (
                <EmailActionPanel 
                  email={activeEmail} 
                  onAction={takeAction} 
                  isStepping={isStepping || envState.done} 
                />
              ) : (
                <div className="h-full glass-card rounded-2xl flex items-center justify-center text-muted-foreground">
                  Select an email to view details
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
