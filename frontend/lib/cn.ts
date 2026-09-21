/**
 * Joins class names, skipping falsy values. Small stand-in for a
 * `clsx`/`tailwind-merge` dependency the project doesn't need.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
