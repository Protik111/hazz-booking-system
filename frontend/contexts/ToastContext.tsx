"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport, type ToastData, type ToastTone } from "@/components/ui/Toast";

interface ShowToastInput {
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  show: (tone: ToastTone, input: ShowToastInput) => void;
  success: (input: ShowToastInput) => void;
  error: (input: ShowToastInput) => void;
  info: (input: ShowToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, input: ShowToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      setToasts((curr) => [...curr, { id, tone, ...input }]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (input) => show("success", input),
      error: (input) => show("error", input),
      info: (input) => show("info", input),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
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
