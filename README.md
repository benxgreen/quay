# Quay

BCP Council's internal portal for the Modern Workplace team. It hosts the team's own services, starting with **laptop replacements**, alongside HaloITSM (which stays the ITSM system and asset register). Smartphone replacements and new starters are planned as further services in the same portal.

Built with Next.js (App Router), TypeScript, PostgreSQL 16 and vanilla CSS following the GOV.UK Design System, to WCAG 2.2 AA.

- **Project rules and decisions:** [`CLAUDE.md`](CLAUDE.md). Read this first: it records every decision made after the handoff.
- **Laptop replacements specification:** [`docs/laptop-replacement-spec.md`](docs/laptop-replacement-spec.md)
- **Database:** [`db/README.md`](db/README.md) and [`docs/database-schema.md`](docs/database-schema.md) (`db/migrations` is the source of truth)
- **Screens:** [`docs/mockups.md`](docs/mockups.md), and how Quay differs from Harbour and the mockups in [`docs/design-differences.md`](docs/design-differences.md)
- **Adding or changing a service:** [`services/README.md`](services/README.md)
- **What's left and what's next:** [`docs/gaps-and-next-steps.md`](docs/gaps-and-next-steps.md)

## Running it locally

You need Node.js 22 and Docker.

```bash
cp .env.example .env
```

Fill in the passwords and `BETTER_AUTH_SECRET` in `.env` (each file says how to generate them), then:

```bash
npm install
```

```bash
npm run db:reset
```

```bash
npm run dev
```

Open http://localhost:3000. Until the Entra ID app registration exists, sign-in goes to `/auth/dev`, where you choose a made-up Halo user (John Smith is an Administrator and on the laptop team). External services run as mocks: nothing reaches Halo or Power Automate unless you set `HALO_CLIENT=http` or `EMAIL_CLIENT=http`.

| Command | What it does |
|---|---|
| `npm run dev` | The portal at http://localhost:3000 |
| `npm run storybook` | Components, patterns and layouts at http://localhost:6006 |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` / `lint:fix` | Biome (Harbour's settings) |
| `npm test` | Vitest, Testing Library and axe-core; the `tests/db` suites need the local database |
| `npm run db:reset` | Rebuilds the local database: setup, migrations and development data |

## How the code is laid out

```text
app/                      Pages and routes. /my is for colleagues, /manage for the team, /api for timers and sign-in.
  manage/replacements/laptops/   The laptop replacement team pages (bookings, sessions, cases, stock, statistics, import, settings)
  manage/users, manage/portal-settings   Portal-wide Administrator pages
  my/replacements/laptop/        The colleague's laptop replacement journey
components/
  ui/                     Generic design-system components (button, table, tag…). Never named after a service.
  patterns/               Combinations of them (filter panel, journal, email editor, settings forms…)
  layouts/                Page frames (TeamLayout/TeamPage, ColleagueLayout/ColleaguePage)
  service/<service>/      Components only one service family needs (replacements/type-tag…)
lib/                      Shared by every service: auth, database, dates, emails, forms, external clients, jobs, Markdown, portal settings, utilities
services/<service>/       One service's business rules and queries (services/replacements/laptops/lib)
db/                       Setup SQL, numbered migrations, scripts and development data
stories/                  Storybook stories, mirroring components/
tests/                    Vitest suites: lib, db (against the local database), ui and patterns
mocks/                    Mock data for the external clients
docs/                     The handoff specification, schema, mockup notes and design differences
```

**Rule of thumb:** if a second service could use it, it belongs in `lib/` or `components/` (`ui` or `patterns`), with no service names in it. Only what is specific to one service lives in `services/<service>` or `app/manage/<service>`. For example, sending an email (`lib/emails/send.ts`) and the email editor (`components/patterns/email-editor`) are shared; the laptop emails, their variables and their counts are in `services/replacements/laptops/lib/emails`.

### Shared building blocks

| Need | Use |
|---|---|
| Read or write the database | `lib/db` (`query`, `queryOne`, `withTransaction`, `describeConstraintError`). Schema-qualified SQL, PgBouncer rules in `CLAUDE.md`. |
| Who is signed in, and access | `lib/auth` (`requireUser`, `requireRole`), `lib/portal/access.ts` |
| Call Halo, Power Automate or GOV.UK | `lib/clients/*`, always through `callExternal` so every call is in the Connection log. Do the call first, then save (`lib/external-first.ts`). |
| Send an email | `lib/emails/send.ts` (render in the portal template and post), `lib/emails/validate.ts` (checks for editors) |
| Dates and working days | `lib/dates` (`working-days.ts`, `format.ts`), `lib/clock.ts` (London today, "as if today is") |
| Forms | `lib/forms` (`FormState`, `readFields`, `readWholeNumber`), `components/patterns/settings-form` |
| Signed links in emails | `lib/auth/signed-id.ts` |
| CSV downloads, wording | `lib/utils/csv.ts`, `lib/utils/text.ts` (`plural`, `listWords`) |
| Scheduled jobs | `lib/jobs/secret.ts` for the timer's secret; the laptop job runner and log are in `services/replacements/laptops/lib/jobs` |
| Markdown | `lib/markdown` (one parser, page, email-HTML and plain-text outputs) |

## Configuration

Settings that change per environment are environment variables (see `.env.example` for every one, with notes). Secrets never go in the database or the code.

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `MIGRATE_DATABASE_URL` | The app through PgBouncer (`portal_app`, port 6432); migrations straight to Postgres (`portal_migrator`, port 5432) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sign-in cookies and the portal's own address |
| `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` | Microsoft Entra ID sign-in. Without them, the development sign-in is used (never in production). |
| `HALO_CLIENT`, `HALO_CLIENT_ID`, `HALO_CLIENT_SECRET`, `HALO_SCOPE` | The Halo API (mock until `HALO_CLIENT=http`) |
| `EMAIL_CLIENT` | Power Automate email webhook (mock until `http`) |
| `JOBS_SECRET` | The bearer token the 9:00am timer sends to `POST /api/replacements/laptops/jobs` |
| `PORTAL_URL`, `CASE_LINK_SECRET` | Links in emails |
| `MOCK_FAILURES`, `BANK_HOLIDAYS_SOURCE`, `BANK_HOLIDAYS_MOCK` | Development only: make mocks fail, work offline |

Links that are not secrets (the Halo site, the Power Automate webhook) are kept in the database and changed by Administrators in Settings › Connections.

## Deploying

Azure App Service (Linux), deployed from the VS Code Azure Resources extension as a zip that App Service builds (`SCM_DO_BUILD_DURING_DEPLOYMENT=true`), like Harbour. Don't use `output: 'standalone'`. Database: Azure Database for PostgreSQL Flexible Server behind PgBouncer. Run `db/setup` once per environment and `npm run db:migrate` on each release; never run the seed outside a local machine. The 9:00am jobs need a timer (Azure Functions timer trigger or similar) calling the jobs endpoint with `JOBS_SECRET`.
