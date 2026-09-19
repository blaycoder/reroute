import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { tokens } from "./tokens";

// tailwind-merge only knows Tailwind's default font-size names (text-sm,
// text-lg…). Without this, it reads our custom sizes (text-body, text-small)
// as text *colors* and drops an earlier text-surface / text-textPrimary as a
// "conflict" — leaving e.g. dark text on the primary button.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(tokens.typography.sizes) }],
    },
  },
});

/** Merge conditional class names with Tailwind-conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Wrap a math string in KaTeX inline delimiters (idempotent), so renderers
 * can separate math from prose:
 *   formatMath("2x + 3")   → "$2x + 3$"
 *   formatMath("$2x + 3$") → "$2x + 3$"
 */
export function formatMath(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length < 2) return trimmed;
  const alreadyDelimited = trimmed.startsWith("$") && trimmed.endsWith("$");
  return alreadyDelimited ? trimmed : `$${trimmed}$`;
}

// Shared focus style for every interactive element (design-system-wide).
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Converts a token easing string ("cubic-bezier(0.16, 1, 0.3, 1)") into the
// array form Framer Motion expects.
export function cubicBezier(easing: string): [number, number, number, number] {
  const match = /cubic-bezier\(([^)]+)\)/.exec(easing);
  if (!match) throw new Error(`Unsupported easing: ${easing}`);
  const values = match[1].split(",").map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((n) => Number.isNaN(n))) {
    throw new Error(`Unsupported easing: ${easing}`);
  }
  return [values[0], values[1], values[2], values[3]];
}
