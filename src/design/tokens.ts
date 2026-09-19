// Design tokens — the single source of truth for Reroute's visual system.
// Components consume tokens either directly (`import { tokens } from
// "@/design/tokens"`, e.g. for Framer Motion curves) or via the Tailwind
// utilities generated from them (see theme.ts). No raw hex/px/ms values
// anywhere else.

export const tokens = {
  colors: {
    primary: "#2E6E5E", // growth
    secondary: "#1F3A5F", // trust
    accent: "#C7791A", // attention
    background: "#FAFAF8",
    surface: "#FFFFFF",
    surfaceMuted: "#F5F5F0",
    border: "#E5E5E0",
    textPrimary: "#1A1A1A",
    textMuted: "#5A5A5A",
    success: "#2E6E5E",
    error: "#8A2A2A",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadows: {
    subtle: "0 1px 2px rgba(0,0,0,0.04)",
    card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
    elevated: "0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08)",
  },
  typography: {
    headingFamily: "Poppins, Inter, sans-serif",
    bodyFamily: "Inter, sans-serif",
    sizes: { h1: 32, h2: 24, h3: 18, body: 16, small: 14, micro: 12 },
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeights: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
  },
  motion: {
    durations: { micro: 150, standard: 250, page: 400, hero: 600, celebration: 800 },
    easings: {
      out: "cubic-bezier(0.16, 1, 0.3, 1)",
      in: "cubic-bezier(0.7, 0, 0.84, 0)",
      inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    },
  },
  breakpoints: { sm: 360, md: 768, lg: 1024, xl: 1280 },
} as const;

export type Tokens = typeof tokens;
