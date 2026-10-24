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
| **Accepting a request books the session** at the time the requester chose; Accept is blocked when the volunteer is not free then | Working |
| **My Support Sessions**: upcoming list, soonest first, "Within 24h" highlight, empty/loading/error states, and a Past sessions list (completed, cancelled, time passed) | Working |
| Cancel a session; the volunteer marks it completed after it starts; the Help Seeker rates it 1 to 5 stars with an optional comment (once, read-only after) | Working (needs migration `20261021000100_session_cancel_feedback.sql`) |
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

## Using the website

Open the site (locally `http://localhost:3000`, or the Vercel URL). Sign in with an `@helplive.edu.my` account: email and password plus the emailed code, or **Sign in with Microsoft (HELP account)**. New accounts register first.

**As a student (Help Seeker)**
1. **Ask for Support** (or **Submit New Request** on the dashboard): pick a category, write a title and description, choose a date, time and support mode (Online, In-Person or Chat), and optionally choose a volunteer.
2. **My Support Requests** shows each request and its status (Pending, Accepted, Declined, Cancelled). You can edit or cancel a Pending request.
3. Once the volunteer accepts, the session is booked for the time you chose. It appears under **Upcoming sessions** on the dashboard and on **My Support Sessions**, with the volunteer's name, date, time and mode. Sessions starting within 24 hours are highlighted.

**As a volunteer**
1. Open **My Profile** and switch to **Volunteer**. The first time, go to **Skills & Availability** and save your weekly availability. Sessions can only be booked inside it.
2. **Incoming Requests** lists Pending requests sent to you. **Accept** books the session at the requested time. It shows **Not available** (disabled) when you are outside your availability or already booked at that time. **Decline** rejects the request.
3. **My Sessions** shows your upcoming and past sessions. Open a session to cancel it, or to **Mark as completed** once its time has started.

**Rules to know**
- Times are one-hour slots in Kuala Lumpur time. A request for a time that is not on the hour is shown as Not available.
- A person cannot be booked twice at the same time, across all their requests. The message is "That time is no longer available, please pick a different time".
- A session booked by Accept has no meeting link yet (still to be designed).

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

### Browser tests (Playwright)

These sign in as a test account and drive the real site, so they need the app and a database in the starting state below. They are not run by CI (the login needs an emailed code, so the tests sign in through the Supabase API instead).

```bash
cd frontend
npx playwright install chromium            # once
CL_EMAIL=<test email> CL_PW=<test password> npm run test:e2e      # PowerShell: $env:CL_EMAIL="..."; $env:CL_PW="..."; npm run test:e2e
```

The email and password are read from the environment and never stored in the repo. Screenshots are saved to `frontend/tests/e2e/evidence/` (git-ignored), one file per test case, for the test documents.

**Test data.** The tests use a fake account, "Sessions Test Seeker", and a volunteer test account who is available on Mondays. The cases need: a Pending request for a free time (Monday), a Pending request for a time outside the volunteer's availability (another weekday), and an Accepted request with no session. Accepting a request in TCUC3_8 books real sessions, so **reset the data before every re-run**: delete the test sessions (`delete from public.session where request_id::text like 'b1b2c3d4-000%'`) and set the Pending requests back to Pending. The request dates must stay in the future. A case skips, rather than fails, when its data is missing.

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

### Demo data

`backend/supabase/seed-demo.sql` fills the site with fake people, requests, sessions and ratings around `b2300682@helplive.edu.my` (3 volunteers, 2 students, incoming requests to accept, upcoming and past sessions). Dates are relative to the day you run it. Run it with `npx supabase db query --linked -f supabase/seed-demo.sql` from `backend/`. The cleanup statements are at the bottom of the file. The fake accounts have no inbox, so nobody can log in as them.

### Test data for sessions

`backend/supabase/seed-sessions.sql` creates three support requests (two accepted, one pending) between two accounts you have already registered. Edit the two emails at the top, make the volunteer set their availability in the app first, then run it in the Supabase SQL editor. Cleanup statements are at the bottom of the file.

## How sessions work

- A session is created from an **accepted** support request. Normally it is booked automatically when the volunteer clicks Accept, at the time the requester chose. If that fails, the volunteer sees the reason and the request stays Accepted.
- Offered times come from the volunteer's weekly availability, in **one-hour slots**, read as **Asia/Kuala_Lumpur** time. Everything is stored in UTC.
- Neither person can be booked at overlapping times, across all their requests. A request can have only one scheduled session at a time.
- These rules are enforced **in the database** (a trigger plus RLS policies), so they hold even if someone skips the app and talks to Supabase directly. The API turns database errors into clear messages (409 "That time is no longer available, please pick a different time").
- The sessions API only returns a participant's name and photo, never their email, student ID or phone number.

API routes:

| Route | Purpose |
|---|---|
| `POST /api/sessions` | Book a session (called when a volunteer accepts a request) |
| `GET /api/sessions?status=Scheduled&upcoming=true` | List the signed-in user's upcoming sessions (`?history=true` for past ones, `?id=` for one) |
| `PATCH /api/sessions` | `{ sessionId, action: "complete" \| "cancel" }` |
| `POST /api/sessions/feedback` | The Help Seeker's rating and comment, once per session |

All routes expect an `Authorization: Bearer <access token>` header and run every query as that user.

To put the upcoming list on a dashboard, render `<UpcomingSessions />` from `frontend/components/sessions/`. It fetches its own data.

## CI and deployment

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: install, generate Next types, type-check, unit tests, production build. Lint runs but does not block yet.
- **Deployment** is handled by Vercel's GitHub integration, not by a workflow. Set the project's Root Directory to `frontend` and add the two environment variables above. In Supabase, add the deployed URL under Authentication, URL Configuration. Microsoft sign-in also needs the Azure provider configured in Supabase.

## Known issues

- Lint reports about 17 errors, mostly in pages that load data inside effects and a few unescaped apostrophes. They do not affect the build.
- Sessions booked by Accept have no meeting link, and In-Person sessions have no venue field. A link or venue step is still to be designed.
- The Accept button lives in Darryl's volunteer dashboard (`components/dashboard/VolunteerRequestList.tsx`) and calls the sessions API to book the session.
- `npm audit` reports vulnerabilities in dependencies that have not been reviewed yet.

## Team

| Member | Area |
|---|---|
| Doreen Tang Le Xi | Profiles and authentication |
| Darryl Gan Jie Hang | Support requests and volunteer matching |
| Livnes Ganesan | Session scheduling and feedback |
