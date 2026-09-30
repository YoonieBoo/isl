# ISL — Learner Intelligence Platform

Operational MVP for **SmartDiscovery + ISL**, built for Peanuts Academy / Praram Nine Technology. Turns learner data and learning evidence into structured, reviewable, traceable, usable learner intelligence.

All 15 build phases from the requirement spec are implemented — see the in-app Dashboard for the live checklist.

Full specs (check every decision against these): [`references/`](./references)
- [`requirement-specifications.md`](./references/requirement-specifications.md) — authoritative build spec
- [`conceptual-overview.md`](./references/conceptual-overview.md) — product concept
- [`presentation-deck-notes.md`](./references/presentation-deck-notes.md) — visual identity notes

## Stack

Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) + Vercel.

**Non-negotiable**: the system of record is Supabase Postgres. Browser `localStorage`/`sessionStorage`/in-memory state/hardcoded JSON are never acceptable as persistence.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account — the first user should be promoted to the `admin` role directly in the `profiles` table (everyone else defaults to `analyst`, per spec §14 there's no self-serve admin escalation).

> Node 22+ is recommended — `@supabase/supabase-js` warns on Node 20 (still works, but is deprecated upstream).

To use the **External AI Adapter** (real learner-signal extraction via OpenAI instead of the deterministic Mock adapter), set `OPENAI_API_KEY` in `.env.local`.

## Seeding demo data

Seeding goes through the real app end-to-end (spec §23 forbids hardcoded JSON as the demo system of record) — it drives a browser against your running dev server:

```bash
npx playwright install chromium   # first time only
npm run dev                       # in one terminal
npm run seed                      # in another
```

Creates a learning environment, uploads/validates a dataset (including a deliberate duplicate ID and an empty-evidence row), runs SmartDiscovery processing (Mock adapter — no API cost), reviews a spread of outcomes (agree/revise/reject/unsure), drafts and approves insight, and adds portfolio artifacts.

## Database

Schema lives in `supabase/migrations/`, one file per build phase. Apply to a linked project with `npx supabase db push`; regenerate types after any schema change with:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Build order

See "Suggested Build Order" in `references/requirement-specifications.md` §22. Current phase is tracked on the in-app Dashboard.
