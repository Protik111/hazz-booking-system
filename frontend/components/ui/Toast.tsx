"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info";

export interface ToastData {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Auto-dismiss after this many ms. Set to 0 to require manual close. */
  durationMs?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TONE_STYLES: Record<ToastTone, { bar: string; icon: string; iconBg: string; title: string }> = {
  success: {
    bar: "bg-success",
    icon: "✓",
    iconBg: "bg-success-bg text-success border-success/30",
    title: "text-text",
  },
  error: {
    bar: "bg-danger",
    icon: "!",
    iconBg: "bg-danger-bg text-danger border-danger/30",
    title: "text-text",
  },
  info: {
    bar: "bg-info",
    icon: "i",
    iconBg: "bg-info-bg text-info border-info/30",
    title: "text-text",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const styles = TONE_STYLES[toast.tone];
  const duration = toast.durationMs ?? (toast.tone === "error" ? 6000 : 4000);

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss, toast.id]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className="pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-card border border-border bg-card p-3 shadow-card"
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-pill border font-bold",
          styles.iconBg,
        )}
      >
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-default font-semibold", styles.title)}>{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-meta text-text-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-text-subtle hover:text-text"
      >
        <span aria-hidden>×</span>
      </button>
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 h-full w-1 rounded-l-card",
          styles.bar,
        )}
      />
    </div>
  );
}

interface ToastViewportProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

/**
 * Fixed bottom-right stack of toasts. Renders nothing when empty so SSR
 * output stays clean.
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
