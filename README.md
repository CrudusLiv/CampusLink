# CampusLink

A peer-to-peer support platform for university students. Students ("Help Seekers") ask for help with academic, wellbeing and general matters. Fellow students who opted in as **Volunteers** accept requests and run support sessions. Administrators supervise registrations.

Built for **BIT216 Software Engineering Principles** as a three-person team project. Only `@helplive.edu.my` accounts can register.

## What works today

| Area | Status |
|---|---|
| Register, log in (email + password with an emailed code, or Microsoft), reset password | Working |
| Profile: view and edit | Working |
| Become a volunteer, set skills and weekly availability | Working |
| Ask for support: submit, edit and cancel requests; browse volunteers | Working |
| Volunteer: see incoming requests, accept or decline | Working |
| **Schedule a support session** from an accepted request (slot picker, mode, optional meeting link, double-booking protection) | Working |
| **My Support Sessions**: upcoming list, soonest first, "Within 24h" highlight, empty/loading/error states | Working |
| Reschedule, cancel, mark completed, star rating on a session | **Prototype only.** Saved in the browser, not the database |
| Admin dashboard and user registrations | **Placeholder only** |
| Session reminder notifications, in-app video | Not built (video is out of scope by design: use a Meet or Zoom link) |

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, CSS Modules
- **Supabase**: Postgres, Auth, Row Level Security
- **Zod** for validation, **Vitest** for unit tests
- **GitHub Actions** for CI, **Vercel** for hosting (Preview per pull request, Production on `main`)

## Repository layout

```
frontend/            Next.js app
  app/               pages and API routes (app/api/sessions/*)
  components/        UI (sessions/, layout/, dashboard/, auth/, volunteer/)
  lib/sessions/      sessions logic: slots, schemas, data access, error mapping
  tests/             Vitest unit tests
backend/supabase/    Supabase CLI project
  migrations/        versioned SQL, applied in filename order
  seed-sessions.sql  optional test data for the sessions feature
documentation/       design, requirements, project plan, testing (in progress)
.github/workflows/   CI
```

## Running it locally

You need **Node 22+** and access to the team's Supabase project.

```bash
cd frontend
npm ci
```

Create `frontend/.env.local` (it is git-ignored, never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=<project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<project anon key>
```

Both values are in the Supabase dashboard under Project Settings, then API. Only the anon key is needed. The app never uses the service-role key.

```bash
npm run dev          # http://localhost:3000
```

The first visit to each page is slow in development because Next compiles on demand.

### Other commands

```bash
npm test             # unit tests
npx next typegen     # generate route types (needed before a type-check on a fresh clone)
npx tsc --noEmit     # type-check
npm run lint         # lint (currently reports errors in some pages; see Known issues)
npm run build        # production build
```

## Database

Supabase hosts Postgres, and every table has Row Level Security switched on. The browser holds the user's login, so **RLS is the real security boundary**, not the API.

Migrations live in `backend/supabase/migrations/` and must run in filename order. To apply them with the Supabase CLI:

```bash
cd backend
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run    # preview first
npx supabase db push
```

If someone applied a migration by pasting it into the SQL editor, Supabase will not know about it and `db push` will try to run it again. Fix that with `npx supabase migration repair --status applied <version>` after confirming the change really exists.

### Test data for sessions

`backend/supabase/seed-sessions.sql` creates three support requests (two accepted, one pending) between two accounts you have already registered. Edit the two emails at the top, make the volunteer set their availability in the app first, then run it in the Supabase SQL editor. Cleanup statements are at the bottom of the file.

## How sessions work

- A session is created from an **accepted** support request, by either the requester or the volunteer.
- Offered times come from the volunteer's weekly availability, in **one-hour slots**, read as **Asia/Kuala_Lumpur** time. Everything is stored in UTC.
- Neither person can be booked at overlapping times, across all their requests. A request can have only one scheduled session at a time.
- These rules are enforced **in the database** (a trigger plus RLS policies), so they hold even if someone skips the app and talks to Supabase directly. The API turns database errors into clear messages (409 "That time is no longer available, please pick a different time").
- The sessions API only returns a participant's name and photo, never their email, student ID or phone number.

API routes:

| Route | Purpose |
|---|---|
| `POST /api/sessions` | Schedule a session |
| `GET /api/sessions?status=Scheduled&upcoming=true` | List the signed-in user's sessions |
| `GET /api/sessions/schedule-context?requestId=` | The accepted request and its free slots |
| `GET /api/sessions/awaiting` | Accepted requests that still need a time |

All routes expect an `Authorization: Bearer <access token>` header and run every query as that user.

To put the upcoming list on a dashboard, render `<UpcomingSessions />` from `frontend/components/sessions/`. It fetches its own data.

## CI and deployment

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: install, generate Next types, type-check, unit tests, production build. Lint runs but does not block yet.
- **Deployment** is handled by Vercel's GitHub integration, not by a workflow. Set the project's Root Directory to `frontend` and add the two environment variables above. In Supabase, add the deployed URL under Authentication, URL Configuration. Microsoft sign-in also needs the Azure provider configured in Supabase.

## Known issues

- Lint reports about 17 errors, mostly in pages that load data inside effects and a few unescaped apostrophes. They do not affect the build.
- The session detail page (`/sessions/[id]`) saves reschedule, cancel, complete and rating to browser storage only. They need real database writes and the `feedback` table.
- The volunteer sidebar's "My Sessions" goes to a separate list of accepted requests, not to `/sessions`.
- `npm audit` reports vulnerabilities in dependencies that have not been reviewed yet.

## Team

| Member | Area |
|---|---|
| Doreen Tang Le Xi | Profiles and authentication |
| Darryl Gan Jie Hang | Support requests and volunteer matching |
| Livnes Ganesan | Session scheduling and feedback |
