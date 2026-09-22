"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseApiOptions {
  /** Show a global toast when the request fails. Defaults to false so
   *  callers can choose their own surface (banner, inline, etc.). */
  toastOnError?: boolean;
  /** Suppress the toast on the *first* (initial) load — useful when a
   *  loading skeleton is shown instead. */
  suppressInitialErrorToast?: boolean;
  /** When false, skip the fetch entirely. Useful for tab-gated views where
   *  one of several queries is irrelevant until the user switches tabs. */
  enabled?: boolean;
}

/**
 * Generic hook to call an async API function, tracking loading/error state.
 * Re-runs whenever `deps` change (like useEffect deps).
 *
 * @example
 *   const { data, loading, error } = useApi(() => listPackages({ page: 1 }), [page]);
 */
export function useApi<T>(
  fn: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[] = [],
  options: UseApiOptions = {},
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const toast = useToast();

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (options.enabled === false) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          setInitialLoadDone(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message = errorMessage(err) ?? "Something went wrong. Please try again.";
        setError(message);
        setLoading(false);
        setInitialLoadDone(true);
        if (
          options.toastOnError &&
          !(options.suppressInitialErrorToast && !initialLoadDone)
        ) {
          toast.error({ title: message });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, options.enabled]);

  return { data, loading, error, refetch };
}
