# Reroute

Diagnosis-first AI learning platform for JAMB Mathematics. Reroute doesn't just
mark answers wrong — it traces each error to the underlying misconception,
builds a "misconception fingerprint," and teaches the highest-leverage fix
first.

**Scope (frozen):** one subject (Mathematics), one hero feature (misconception
diagnosis + prioritized next action), one loop —
**Assess → Diagnose → Prioritize → Teach → Practice → Reassess → Adapt.**

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · KaTeX ·
Prisma 8 (release candidate) + SQLite (dev) · Zod · Vercel

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    - SQLITE_PATH defaults to ./db/reroute.db; add OPENAI_API_KEY or
#      ZHIPU_API_KEY when the intervention generator is built.

# 3. Create the database and load the question bank
npm run db:init    # creates the tables from the contract
npm run seed       # loads src/data/questions.json

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
| `npm run emit`      | Re-emit `contract.json` / `contract.d.ts` after editing `contract.prisma` |
| `npm run db:init`   | Create the database tables       |
| `npm run seed`      | Replace the question bank        |

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
  prisma/               contract.prisma (source) · contract.json / contract.d.ts (emitted — commit, never edit)
prisma.config.ts        Prisma 8 config (contract path, database path)
scripts/                seed.ts
public/fallback/        Offline fallback intervention payloads
db/                     Local SQLite file (git-ignored)
```

Design tokens live in `src/design/tokens.ts` and flow into Tailwind via
`src/design/theme.ts` — never edit `tailwind.config.ts` colors/fonts directly,
and never hardcode hex/px/ms values in components. Use `cn()` and
`formatMath()` from `src/design/utils.ts`; for Framer Motion, import
`tokens.motion` (durations/easings) directly.

## Notes

- **Prisma 8 is a release candidate** (`8.0.0-rc.N`), and a new RC may rename
  or remove APIs — read each release's breaking-changes notes before bumping.
  It is a different product from Prisma 6/7: a contract (`contract.prisma`)
  instead of `schema.prisma`, `@prisma/orm-sqlite` instead of `@prisma/client`,
  and `db.orm.<Model>` queries instead of `prisma.<model>.<op>`.
- **Editing the schema:** change `src/prisma/contract.prisma`, run
  `npm run emit`, and commit the regenerated `contract.json` / `contract.d.ts`
  (the app imports them; there is no build-time emit step).
- **Prod database:** the SQLite target does not persist on serverless hosts.
  Production needs the Postgres target (`@prisma/orm-postgres`), where models
  are addressed as `db.orm.public.<Model>` — every query in `src/` would need
  that prefix. Not done yet.
- **react-katex** ships no types; a stub declaration lives in
  `src/types/react-katex.d.ts`.
