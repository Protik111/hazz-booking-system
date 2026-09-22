"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface DatePickerProps {
  /** ISO YYYY-MM-DD string. Empty string = no selection. */
  value?: string;
  onChange?: (iso: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Minimum selectable date (inclusive). */
  fromDate?: Date;
  /** Maximum selectable date (inclusive). */
  toDate?: Date;
}

/**
 * App-styled date picker. Renders a popover with a `react-day-picker`
 * calendar. The trigger matches the rest of the form inputs and shows the
 * formatted selected date, or a placeholder when nothing is picked.
 *
 * Internally stores ISO `YYYY-MM-DD` to play nicely with the existing
 * `<input type="date" />` flow used by the Pilgrim form.
 */
export default function DatePicker({
  value,
  onChange,
  label,
  error,
  hint,
  placeholder = "Pick a date",
  id,
  disabled,
  className,
  fromDate,
  toDate,
}: DatePickerProps) {
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;

  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const [open, setOpen] = React.useState(false);

  function handleSelect(next: Date | undefined) {
    if (!next) {
      onChange?.("");
      return;
    }
    onChange?.(format(next, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={triggerId}
          className="text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
        >
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-chip border bg-card px-3.5 py-2 text-default",
              "focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-danger focus:border-danger"
                : "border-border focus:border-emerald",
              !selected && "text-text-subtle",
              className,
            )}
          >
            <span>
              {selected ? format(selected, "PPP") : placeholder}
            </span>
            <CalendarIcon
              className="h-4 w-4 text-text-muted opacity-70"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          sideOffset={6}
        >
          <div className="rdp-root p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              startMonth={fromDate}
              endMonth={toDate}
              showOutsideDays
              captionLayout="dropdown"
            />
          </div>
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-meta text-danger">{error}</p>
      ) : hint ? (
        <p className="text-meta text-text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
