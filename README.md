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
Prisma 8 (release candidate) + PostgreSQL · Zod · Vercel

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    - DATABASE_URL: a Postgres connection string (the DIRECT one, for local
#      work and migrations — see .env.example). Use a development database,
#      not production.
#    - OPENAI_API_KEY / ZHIPU_API_KEY are optional (AI diagnosis).

# 3. Generate the typed client and create the tables
npm run emit       # writes src/prisma/contract.json + contract.d.ts
npm run db:init    # the question bank is code (src/data/question-bank.ts): nothing to seed

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
  data/                 question-bank (40 questions + answer keys, server-only) · interventions (lesson content, no answers)
  prisma/               contract.prisma (source) · contract.json / contract.d.ts (emitted — commit, never edit)
prisma.config.ts        Prisma 8 config (contract path, DATABASE_URL)
migrations/             Migration history (created by `migration plan`)
public/fallback/        Per-concept lesson text + question ids (no answers)
```

Design tokens live in `src/design/tokens.ts` and flow into Tailwind via
`src/design/theme.ts` — never edit `tailwind.config.ts` colors/fonts directly,
and never hardcode hex/px/ms values in components. Use `cn()` and
`formatMath()` from `src/design/utils.ts`; for Framer Motion, import
`tokens.motion` (durations/easings) directly.

## How it works

Everything a student sees is computed from **their own answers** — there are no
seeded profiles, demo students or scripted outcomes.

- **Diagnostic:** 12 questions (3 per concept). The server routes: it always
  opens with `q_alg_002`, then picks each next question from the student's real
  answer *and* pace (correct+fast → harder, correct+slow → same level,
  wrong+fast → easier, wrong+slow → switch topic and start easy), never
  repeating one. Only one question is sent at a time, so a refresh resumes where
  the student left off and no answer key reaches the browser.
- **Passive telemetry:** first-tap time, dwell, option switches, idle time,
  timeouts. Confidence and time pressure are inferred on the server; the student
  is never asked how sure they are.
- **Profile:** `computeLearnerProfile(sessionId)` (`src/lib/compute-profile.ts`)
  rebuilds accuracy, speed, calibration, per-topic error type, priority and
  readiness from the session's attempts, then caches it. Practice and
  reassessment answers are attempts too, so mastery moves as the student learns.
- **AI diagnosis:** at completion the AI reads each wrong answer against the
  student's telemetry and may override the question's pre-tagged misconception
  (shown on the fingerprint as "AI overrode the static mapping"). It has a 6s
  deadline and a deterministic fallback. It never grades or writes questions.
- **Questions:** all 40 are pre-written in `src/data/question-bank.ts`, each
  wrong option tied to a named misconception. Nothing is generated on the fly.
- **When the server is unreachable:** screens show a Retry button. After Retry
  has been pressed more than once, a "Try cached data" link appears beneath it —
  but only if this browser already holds a real response of the student's own
  for that screen. Nothing is pre-seeded, and answers are never faked: they must
  be graded by the server.

## Notes

- **Prisma 8 is a release candidate** (`8.0.0-rc.N`), and a new RC may rename
  or remove APIs — read each release's breaking-changes notes before bumping.
  It is a different product from Prisma 6/7: a contract (`contract.prisma`)
  instead of `schema.prisma`, `@prisma/orm-postgres` instead of `@prisma/client`,
  and `db.orm.public.<Model>` queries instead of `prisma.<model>.<op>`.
- **Editing the schema:** change `src/prisma/contract.prisma`, run
  `npm run emit`, and commit the regenerated `contract.json` / `contract.d.ts`
  (the app imports them; there is no build-time emit step, so Vercel's build
  needs no Prisma CLI).
- **Timestamps are ISO text, ids are app-generated, booleans are 0/1.** On
  Postgres a `DateTime` column reads back as a `Temporal` object, which Node 24
  (Vercel's newest) does not provide, so the contract stores ISO-8601 text and
  the code uses `nowIso()` / `newId()` from `src/lib/db.ts`.
- **The client is `/runtime`, not `/serverless`.** `@prisma/orm-postgres/serverless`
  is for edge runtimes and omits `db.orm` and `db.transaction()`; Vercel's normal
  Node functions use the standard client with the pooled connection string.

## Deploying (Prisma Postgres + Vercel)

1. **Database:** create a production database in the Prisma Console. Generate the
   direct connection string for migrations and copy the pooled one for the app.
2. **Baseline migration (once):** with `DATABASE_URL` set to the direct string,
   run `npx prisma@8.0.0-rc.15 migration plan --name init` and commit
   `migrations/`.
3. **Apply it:** `npx prisma@8.0.0-rc.15 migration status --db "<direct url>"` to
   preview, then `db migrate --db "<direct url>"`. Do this from your machine (or
   CI), not from Vercel's build.
4. **Vercel:** import the repo, set `DATABASE_URL` to the **pooled** string (and
   optionally `OPENAI_API_KEY`), check the project's Node.js version, deploy.
5. **Smoke test** the live URL: start a diagnostic, refresh mid-way, finish, and
   check the function logs if anything fails.
- **react-katex** ships no types; a stub declaration lives in
  `src/types/react-katex.d.ts`.
