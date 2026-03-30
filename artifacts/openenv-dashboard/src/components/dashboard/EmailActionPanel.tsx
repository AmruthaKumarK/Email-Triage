import React, { useState, useEffect } from "react";
import type { Email } from "@workspace/api-client-react/src/generated/api.schemas";
import { format } from "date-fns";
import { Paperclip, Reply, ShieldAlert, Tag, Archive, CornerUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  email: Email;
  onAction: (action: any) => void;
  isStepping: boolean;
}

const CATEGORIES = ["sales", "support", "legal", "hr", "executive", "spam", "newsletter", "personal"];
const PRIORITIES = ["critical", "high", "medium", "low"];

export function EmailActionPanel({ email, onAction, isStepping }: Props) {
  const [category, setCategory] = useState<string>(email.category || "");
  const [priority, setPriority] = useState<string>(email.priority || "");
  const [replyText, setReplyText] = useState<string>("");

  // Reset local state when email changes
  useEffect(() => {
    setCategory(email.category || "");
    setPriority(email.priority || "");
    setReplyText("");
  }, [email.id]);

  const handleClassify = () => {
    if (!category) return;
    onAction({ action_type: "classify", email_id: email.id, category });
  };

  const handlePrioritize = () => {
    if (!priority) return;
    onAction({ action_type: "prioritize", email_id: email.id, priority });
  };

  const handleReply = () => {
    if (!replyText) return;
    onAction({ action_type: "reply", email_id: email.id, reply_text: replyText });
  };

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      {/* Email Header */}
      <div className="p-6 border-b border-white/5 bg-white/[0.02]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{email.subject}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-white/80">{email.sender}</span>
              <span>&lt;{email.sender_domain}&gt;</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-black/40 px-3 py-1.5 rounded-full">
            {format(new Date(email.timestamp), "MMM d, h:mm a")}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          {email.has_attachment && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20">
              <Paperclip className="w-3.5 h-3.5" /> Attachment
            </span>
          )}
          {email.requires_reply && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-md border border-orange-500/20">
              <Reply className="w-3.5 h-3.5" /> Requires Reply
            </span>
          )}
          {email.is_processed && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Processed
            </span>
          )}
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 p-6 overflow-y-auto bg-black/20">
        <div className="text-white/80 whitespace-pre-wrap leading-relaxed font-sans text-[15px]">
          {email.body}
        </div>
      </div>

      {/* Action Console */}
      <div className="p-6 border-t border-white/5 bg-white/[0.03] space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ZapIcon /> Agent Action Console
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Classification */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">Category Label</label>
            <div className="flex gap-2">
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
              >
                <option value="" disabled>Select category...</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <button 
                onClick={handleClassify}
                disabled={!category || isStepping}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Tag className="w-4 h-4" />
                Classify
              </button>
            </div>
          </div>

          {/* Prioritization */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">Priority Level</label>
            <div className="flex gap-2">
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all appearance-none"
              >
                <option value="" disabled>Select priority...</option>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
              <button 
                onClick={handlePrioritize}
                disabled={!priority || isStepping}
                className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                Rank
              </button>
            </div>
          </div>
        </div>

        {/* Reply Box */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-medium text-white/60">Draft Reply</label>
          <div className="flex flex-col gap-2">
            <textarea 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a response to this email..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none h-24"
            />
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => onAction({ action_type: "archive", email_id: email.id })}
                  disabled={isStepping}
                  className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 transition-all flex items-center gap-2"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  onClick={() => onAction({ action_type: "escalate", email_id: email.id })}
                  disabled={isStepping}
                  className="px-4 py-2 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive-foreground rounded-lg transition-all flex items-center gap-2"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Escalate
                </button>
              </div>
              <button
                onClick={handleReply}
                disabled={!replyText || isStepping}
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-6 py-2 rounded-lg font-bold shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <CornerUpRight className="w-4 h-4" /> Send Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
