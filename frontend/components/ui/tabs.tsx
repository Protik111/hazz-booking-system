"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Tab strip — the row that holds individual tab triggers. Supports an
 * underline (default) or pill variant for visually distinct presentations.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: "underline" | "pill";
  }
>(({ className, variant = "underline", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center text-text-muted",
      variant === "underline"
        ? "h-10 justify-start gap-1 border-b border-border w-full"
        : "h-auto gap-1 rounded-chip bg-base p-1",
      className,
    )}
    role="tablist"
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Tab trigger — supports an icon and/or a logo (any React node) on the
 * left side of the label. The active tab gets a brand-colored underline
 * (or filled background in `pill` mode) plus an animated indicator.
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    icon?: React.ReactNode;
    /** Optional logo (image/SVG) — rendered to the left of the icon/label. */
    logo?: React.ReactNode;
    /** Force the pill visual style when the parent list uses underline. */
    pill?: boolean;
  }
>(({ className, children, icon, logo, pill, ...props }, ref) => {
  const hasIconOrLogo = Boolean(icon) || Boolean(logo);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
        "rounded-chip px-3 py-1.5 text-default font-medium",
        "transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-emerald",
        "data-[state=inactive]:hover:text-text",
        // Pill mode visual (used both as parent variant="pill" and per-trigger override)
        pill &&
          "data-[state=active]:bg-emerald data-[state=active]:text-white data-[state=active]:shadow-sm",
        !pill &&
          "data-[state=active]:[&]:shadow-none " +
            "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-emerald after:transition-transform after:duration-200 after:scale-x-0 data-[state=active]:after:scale-x-100",
        className,
      )}
      {...props}
    >
      {logo && (
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-card border border-border",
            "transition-transform group-data-[state=active]:scale-105",
          )}
          aria-hidden
        >
          {logo}
        </span>
      )}
      {icon && (
        <span
          className="inline-flex h-4 w-4 items-center justify-center"
          aria-hidden
        >
          {icon}
        </span>
      )}
      {children}
      {/* Screen reader hint when there's an icon but no visible role attribute */}
      {hasIconOrLogo && (
        <span className="sr-only">
          {typeof children === "string" ? children : "Tab"}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none",
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
