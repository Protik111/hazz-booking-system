"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Toaster, toast } from "sonner";

export type ToastTone = "success" | "error" | "info" | "warning";

interface ToastInput {
  title: string;
  description?: string;
  /** Auto-dismiss after this many ms. Defaults are handled by sonner. */
  durationMs?: number;
}

interface ToastContextValue {
  success: (input: ToastInput) => void;
  error: (input: ToastInput) => void;
  info: (input: ToastInput) => void;
  warning: (input: ToastInput) => void;
  dismiss: (id?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Sonner accepts a title and a description as separate args. */
function fire(tone: ToastTone, { title, description, durationMs }: ToastInput) {
  const options = description
    ? { description, duration: durationMs }
    : { duration: durationMs };
  switch (tone) {
    case "success":
      toast.success(title, options);
      break;
    case "error":
      toast.error(title, options);
      break;
    case "info":
      toast.info(title, options);
      break;
    case "warning":
      toast.warning(title, options);
      break;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ToastContextValue>(
    () => ({
      success: (input) => fire("success", input),
      error: (input) => fire("error", input),
      info: (input) => fire("info", input),
      warning: (input) => fire("warning", input),
      dismiss: (id) => toast.dismiss(id),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* shadcn-recommended Toaster config: top-right stack, system colors,
          no expand button, matches our theme tokens. */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        theme="system"
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-card group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-card",
            description: "group-[.toast]:text-text-muted",
            actionButton:
              "group-[.toast]:bg-emerald group-[.toast]:text-white",
            cancelButton:
              "group-[.toast]:bg-base group-[.toast]:text-text-muted",
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
