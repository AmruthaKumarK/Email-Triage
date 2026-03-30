import React from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md w-full glass-panel p-8 text-center rounded-3xl border border-white/10">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-2">404</h1>
        <h2 className="text-xl font-semibold text-white/80 mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          The environment coordinate you're looking for doesn't exist in the current trajectory.
        </p>
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
