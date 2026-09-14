# Backend

The backend is [Supabase](https://supabase.com) — Postgres, Auth, Storage, and Edge Functions — configured as a local CLI project under `supabase/`. There is no separate application server; the frontend talks to Supabase directly via `@supabase/supabase-js` / `@supabase/ssr`.

## Structure

- `supabase/config.toml` — local dev stack configuration
- `supabase/migrations/` — versioned SQL schema migrations (empty until the first migration is added)
- `supabase/seed.sql` — local dev seed data, run on `supabase db reset`

## Getting started

1. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
2. Copy `.env.example` to `.env` and fill in values (from `supabase status` once running locally, or the hosted project's dashboard).
3. From this directory, start the local stack:
   ```
   supabase start
   ```
4. Add schema changes as new files in `supabase/migrations/` (see the CLI docs for `supabase migration new` and `supabase db diff`), then apply with:
   ```
   supabase db reset
   ```

## Linking to a hosted project

```
supabase link --project-ref <project-ref>
supabase db push
```
