"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./toast.module.css";

export type ToastKind = "success" | "error" | "info";
export type ToastInput = { title: string; message?: string; kind?: ToastKind; durationMs?: number };
type ToastRecord = ToastInput & { id: string; kind: ToastKind };
type ToastContextValue = { pushToast: (toast: ToastInput) => string; dismissToast: (id: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const kind = input.kind ?? "info";
    const record: ToastRecord = { ...input, id, kind };
    setToasts((current) => [...current.filter((toast) => !(toast.title === record.title && toast.message === record.message)), record].slice(-MAX_TOASTS));
    const durationMs = Math.max(1500, Math.min(input.durationMs ?? (kind === "error" ? 6500 : 3800), 15000));
    timers.current.set(id, window.setTimeout(() => dismissToast(id), durationMs));
    return id;
  }, [dismissToast]);

  useEffect(() => () => { for (const timer of timers.current.values()) window.clearTimeout(timer); timers.current.clear(); }, []);

  const value = useMemo(() => ({ pushToast, dismissToast }), [dismissToast, pushToast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className={styles.viewport} aria-label="Notifications" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => <article key={toast.id} className={styles.toast} data-kind={toast.kind} role={toast.kind === "error" ? "alert" : "status"}>
        <span className={styles.icon} aria-hidden="true">{toast.kind === "success" ? <CheckCircle2 /> : toast.kind === "error" ? <CircleAlert /> : <Info />}</span>
        <div className={styles.copy}><strong>{toast.title}</strong>{toast.message ? <span>{toast.message}</span> : null}</div>
        <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification"><X size={16} /></button>
      </article>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
