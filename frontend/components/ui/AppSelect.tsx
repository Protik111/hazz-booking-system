"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ShadSelect";
import { cn } from "@/lib/utils";

interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: AppSelectOption[];
  value?: string;
  /** Defaults to empty string (""). Used for the implicit "all" option. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  id?: string;
  className?: string;
  /** Disables the entire control. */
  disabled?: boolean;
  /** Visual size variant. */
  size?: "sm" | "md";
}

/**
 * App-styled select that wraps the shadcn-style Radix Select. Accepts the
 * same `label / error / hint / options / placeholder` shape the existing
 * legacy `<Select />` used, so call sites can swap over with minimal
 * changes.
 *
 * Renders a label above, a trigger, and either an error or a hint below —
 * all matching the existing typography/spacing of the rest of the UI.
 */
export default function AppSelect({
  label,
  error,
  hint,
  placeholder = "Select…",
  options,
  value,
  defaultValue = "",
  onValueChange,
  id,
  className,
  disabled,
  size = "md",
}: AppSelectProps) {
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;

  const heightClass = size === "sm" ? "h-9 text-meta" : "h-10 text-default";

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
      <Select
        value={value ?? undefined}
        defaultValue={defaultValue || undefined}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={triggerId}
          error={Boolean(error)}
          className={cn(heightClass, className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-meta text-danger">{error}</p>
      ) : hint ? (
        <p className="text-meta text-text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
