import { useState, useEffect } from "react";

type ToastProps = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

let memoryState: ToastProps[] = [];
let listeners: Function[] = [];

export function toast(props: ToastProps) {
  memoryState = [...memoryState, props];
  listeners.forEach((listener) => listener(memoryState));
  setTimeout(() => {
    memoryState = memoryState.slice(1);
    listeners.forEach((listener) => listener(memoryState));
  }, 5000);
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>(memoryState);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return { toast, toasts };
}
