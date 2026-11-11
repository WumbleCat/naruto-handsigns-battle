# Supabase

Schema lives in `migrations/`, numbered and applied in order. Every table has Row Level
Security; a player can read and write only their own rows.

## Apply the migrations

Option A, Supabase CLI (recommended once you have the CLI installed and are logged in):

```
supabase link --project-ref <your-project-ref>
supabase db push
```

Option B, dashboard: open the SQL editor in your Supabase project and run each file in
`migrations/` in numeric order.

## Environment

Copy `.env.example` to `.env.local` at the repository root and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` from Project Settings → API. Restart `npm run dev` afterwards.

## Email confirmation

Supabase enables "Confirm email" by default. The sign-up form handles both modes: with
confirmation on, it shows a "check your inbox" state; with it off (Authentication → Providers →
Email), players land on Home immediately. Turn it off for local demos.

## Types

`src/lib/database.types.ts` is hand-written to match these migrations. After any schema change,
regenerate it with `npm run db:types` (requires a linked CLI) or update it by hand.
