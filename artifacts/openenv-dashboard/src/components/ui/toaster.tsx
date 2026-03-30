import { useToast } from "./use-toast";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col md:max-w-[420px] gap-2">
      <AnimatePresence>
        {toasts.map((toast, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={cn(
              "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-6 pr-8 shadow-xl transition-all",
              toast.variant === "destructive" 
                ? "border-destructive/50 bg-destructive/10 text-destructive-foreground backdrop-blur-xl"
                : "glass-panel text-foreground"
            )}
          >
            <div className="flex gap-4 items-start">
              {toast.variant === "destructive" ? (
                <AlertCircle className="h-6 w-6 text-destructive mt-0.5" />
              ) : (
                <CheckCircle className="h-6 w-6 text-primary mt-0.5" />
              )}
              <div className="grid gap-1">
                {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
                {toast.description && (
                  <div className="text-sm opacity-90">{toast.description}</div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
