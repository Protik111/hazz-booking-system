"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";

interface UseConfirmActionOptions<T> {
  /** Title shown on the confirmation dialog. */
  title: string | ((arg: T) => string);
  /** Optional description shown beneath the title. */
  description?: string | ((arg: T) => string);
  /** Label of the confirm button. */
  confirmText?: string;
  /** Cancel-button label. */
  cancelText?: string;
  /** Visual variant of the confirm button. Defaults to "primary". */
  variant?: "primary" | "danger";
  /** Toast title shown on success. */
  successTitle?: string | ((arg: T) => string);
  /** Toast title shown on failure. */
  errorTitle?: string | ((arg: T) => string);
  /** Async action to run after the user confirms. */
  action: (arg: T) => Promise<unknown> | unknown;
  /** Invoked after a successful run (e.g. refetch the list). */
  onSuccess?: (arg: T) => void;
}

interface UseConfirmActionResult<T> {
  /** Trigger the confirmation flow for `arg`. */
  confirm: (arg: T) => void;
  /** Manually close the dialog (e.g. after a successful API call). */
  close: () => void;
  /** True while the action is in flight. */
  busy: boolean;
  /** The arg currently awaiting confirmation, or null. */
  pending: T | null;
  /** Props to spread onto a `<ConfirmDialog>` element. */
  dialogProps: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "primary" | "danger";
    loading: boolean;
  };
}

/**
 * Wraps the "open ConfirmDialog → run action → toast result" pattern that
 * recurs across admin/customer pages. Returns props for a `<ConfirmDialog>`
 * plus a `confirm(arg)` trigger.
 *
 * Usage:
 *   const cancel = useConfirmAction({
 *     title: "Delete this item?",
 *     confirmText: "Delete",
 *     variant: "danger",
 *     successTitle: "Item deleted",
 *     action: (id: string) => api.deleteItem(id),
 *     onSuccess: refetch,
 *   });
 *
 *   return (
 *     <>
 *       <button onClick={() => cancel.confirm(item.id)}>…</button>
 *       <ConfirmDialog {...cancel.dialogProps} />
 *     </>
 *   );
 */
export function useConfirmAction<T>(opts: UseConfirmActionOptions<T>): UseConfirmActionResult<T> {
  const [pending, setPending] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const confirm = useCallback((next: T) => setPending(next), []);
  const close = useCallback(() => {
    if (!busy) setPending(null);
  }, [busy]);

  const run = useCallback(async () => {
    if (pending === null || busy) return;
    setBusy(true);
    try {
      await opts.action(pending);
      const successTitle =
        typeof opts.successTitle === "function"
          ? opts.successTitle(pending)
          : opts.successTitle;
      if (successTitle) toast.success({ title: successTitle });
      opts.onSuccess?.(pending);
      setPending(null);
    } catch (err) {
      const errorTitle =
        typeof opts.errorTitle === "function"
          ? opts.errorTitle(pending)
          : (opts.errorTitle ?? "Action failed");
      toast.error({ title: errorTitle, description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
    // opts is read once on each `run`; consuming pages can memoize the
    // options object if they want stable references, but doing so is
    // optional — `confirm` and `dialogProps` are the public surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busy]);

  const title =
    typeof opts.title === "function" && pending !== null
      ? opts.title(pending)
      : (opts.title as string);
  const description =
    typeof opts.description === "function" && pending !== null
      ? opts.description(pending)
      : (opts.description as string | undefined);

  return {
    confirm,
    close,
    busy,
    pending,
    dialogProps: {
      open: pending !== null,
      onClose: close,
      onConfirm: run,
      title,
      description,
      confirmText: opts.confirmText,
      cancelText: opts.cancelText,
      variant: opts.variant ?? "primary",
      loading: busy,
    },
  };
}
