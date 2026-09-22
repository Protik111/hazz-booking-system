import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn-style class name combiner. Merges Tailwind utility classes while
 * removing conflicts (e.g. `p-2 p-4` becomes `p-4`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
