import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

// Bridge from raw tokens → Tailwind theme extension. Utilities are generated
// exclusively from this mapping so the token file stays the single source of
// truth. Pixel/ms suffixes are added here; tokens stay unitless numbers.

type NumericScale = Record<string, number>;

const px = (scale: NumericScale) =>
  Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, `${v}px`]));
const ms = (scale: NumericScale) =>
  Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, `${v}ms`]));
const str = (scale: Record<string, number>) =>
  Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, String(v)]));

// Puts the next/font variable first so the optimized font wins, with the
// token's named stack (Poppins/Inter/system) as fallback.
const families = (stack: string, fontVar: string): string[] => [
  fontVar,
  ...stack.split(",").map((f) => f.trim()),
];

const lh = (name: keyof typeof tokens.typography.lineHeights) =>
  String(tokens.typography.lineHeights[name]);

export const theme = {
  colors: tokens.colors,
  spacing: px(tokens.spacing),
  borderRadius: px(tokens.radius),
  boxShadow: tokens.shadows,
  fontFamily: {
    heading: families(tokens.typography.headingFamily, "var(--font-poppins)"),
    body: families(tokens.typography.bodyFamily, "var(--font-inter)"),
  },
  fontSize: {
    h1: [`${tokens.typography.sizes.h1}px`, { lineHeight: lh("tight") }],
    h2: [`${tokens.typography.sizes.h2}px`, { lineHeight: lh("tight") }],
    h3: [`${tokens.typography.sizes.h3}px`, { lineHeight: lh("tight") }],
    body: [`${tokens.typography.sizes.body}px`, { lineHeight: lh("normal") }],
    small: [`${tokens.typography.sizes.small}px`, { lineHeight: lh("normal") }],
    micro: [`${tokens.typography.sizes.micro}px`, { lineHeight: lh("normal") }],
  },
  fontWeight: str(tokens.typography.weights),
  lineHeight: str(tokens.typography.lineHeights),
  transitionDuration: ms(tokens.motion.durations),
  transitionTimingFunction: tokens.motion.easings,
  keyframes: {
    shimmer: { "0%": { opacity: "1" }, "100%": { opacity: "0.4" } },
    "toast-in": {
      "0%": { opacity: "0", transform: `translateY(${tokens.spacing.md}px)` },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
    "toast-out": { "0%": { opacity: "1" }, "100%": { opacity: "0" } },
    "fade-up": {
      "0%": { opacity: "0", transform: `translateY(${tokens.spacing.md}px)` },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
    "draw-check": {
      "0%": { "stroke-dashoffset": "24" },
      "100%": { "stroke-dashoffset": "0" },
    },
  },
  animation: {
    shimmer: `shimmer ${tokens.motion.durations.hero}ms ${tokens.motion.easings.inOut} infinite alternate`,
    "toast-in": `toast-in ${tokens.motion.durations.standard}ms ${tokens.motion.easings.out} both`,
    "toast-out": `toast-out ${tokens.motion.durations.micro}ms ${tokens.motion.easings.in} both`,
    "fade-up": `fade-up ${tokens.motion.durations.standard}ms ${tokens.motion.easings.out} both`,
    "draw-check": `draw-check ${tokens.motion.durations.page}ms ${tokens.motion.easings.out} both`,
  },
  screens: px(tokens.breakpoints),
} satisfies NonNullable<NonNullable<Config["theme"]>["extend"]>;
