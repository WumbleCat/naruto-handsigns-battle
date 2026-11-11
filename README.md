# Jutsu Duel (working title)

A desktop web game where two players fight by performing Naruto-style hand signs on their webcam.
Completing a sign sequence casts a jutsu that damages the opponent; the first to bring the other to
0 HP wins. Version 1 is a playable demo against a bot. Online 1v1 with live webcam video follows.

Status: milestone v0.1.0 (scaffold, design system, routing, auth). Live status in
`docs/PROGRESS.md`; design in `docs/DESIGN.md` and `docs/FRONTEND_DESIGN.md`; conventions in
`CLAUDE.md`.

## Setup

Requirements: Node 22 or newer, a Supabase project.

```
npm install
cp .env.example .env.local        # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                       # http://localhost:5173
```

Apply the database schema once per Supabase project: see `supabase/README.md` (CLI `supabase db
push`, or paste the files in `supabase/migrations/` into the SQL editor in order).

Without the two environment variables the app still runs, but sign up and log in report that
accounts are not configured.

## Commands

```
npm run dev          dev server with dev-only routes (/dev/styleguide, /dev/recorder)
npm run build        production build
npm run check        lint, format check, typecheck and tests; the merge gate
npm test             tests only
```

The Python training tooling in `ml/` arrives in milestone v0.6.0 and is managed with `uv`.
