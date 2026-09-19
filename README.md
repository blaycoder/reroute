# Reroot

Diagnosis-first AI learning platform for JAMB Mathematics. Reroot doesn't just
mark answers wrong — it traces each error to the underlying misconception,
builds a "misconception fingerprint," and teaches the highest-leverage fix
first.

**Scope (frozen):** one subject (Mathematics), one hero feature (misconception
diagnosis + prioritized next action), one loop —
**Assess → Diagnose → Prioritize → Teach → Practice → Reassess → Adapt.**

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · KaTeX ·
Prisma 6 + SQLite (dev) / Postgres-ready (prod) · Zod · Vercel

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    - DATABASE_URL is pre-set for local SQLite; add OPENAI_API_KEY or
#      ZHIPU_API_KEY when the intervention generator is built.

# 3. Apply migrations + generate Prisma Client
npx prisma migrate dev

# 4. Run
npm run dev        # http://localhost:3000
```

### Scripts

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server                       |
| `npm run build`     | Production build (runs typecheck)|
| `npm start`         | Serve the production build       |
| `npm run lint`      | ESLint                           |
| `npm test`          | Vitest unit tests (logic layer)  |
| `npx prisma studio` | Browse the SQLite database       |

## Structure

```
src/
  app/
    (marketing)/        Landing page
    onboarding/         Learner onboarding
    diagnostic/         Adaptive diagnostic assessment
    fingerprint/        Misconception fingerprint view
    intervention/       Targeted teaching session
    practice/           Practice loop
    reassessment/       Re-test after intervention
    progress/           Mastery / progress dashboard
    api/
      diagnostic/       start · answer · complete
      learner/          [studentId]/fingerprint
      intervention/     generate · verify
  components/           ui · assessment · fingerprint · intervention
  lib/                  db · rules-engine · telemetry · mastery · katex
  design/               tokens.ts (source of truth) · theme.ts (Tailwind bridge) · utils.ts (cn · formatMath)
  types/                learner-state · question contracts
  data/                 questions · misconceptions · syllabus-excerpts · fallback-interventions (server-only answer keys)
prisma/                 schema.prisma
public/fallback/        Offline fallback intervention payloads
db/                     Local SQLite file (git-ignored)
```

Design tokens live in `src/design/tokens.ts` and flow into Tailwind via
`src/design/theme.ts` — never edit `tailwind.config.ts` colors/fonts directly,
and never hardcode hex/px/ms values in components. Use `cn()` and
`formatMath()` from `src/design/utils.ts`; for Framer Motion, import
`tokens.motion` (durations/easings) directly.

## Notes

- **Prisma major:** pinned to v6 — v7 removed `url = env("DATABASE_URL")`
  from schema files (requires driver adapters + `prisma.config.ts`).
- **Prod database:** flip `provider` in `prisma/schema.prisma` to
  `postgresql`, point `DATABASE_URL` at Postgres, and run
  `npx prisma migrate deploy`.- **react-katex** ships no types; a stub declaration lives in
  `src/types/react-katex.d.ts`.
