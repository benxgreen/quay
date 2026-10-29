# Quay – Device portal (BCP Council)

Context for Claude Code. Read this first, then the docs in `docs/`.

## What this is

Quay is an internal portal for BCP Council's Modern Workplace team, built to grow into one system that hosts the team's internal tools. The first area is the **Device portal** (working name devices.services.bcpcouncil.gov.uk, likely hosted at quay.internal.bcpcouncil.gov.uk or similar). It works alongside HaloITSM: Halo stays the ITSM system and asset register.

Services planned inside the portal:

| Service | Schema | Run by | Sends from | State |
|---|---|---|---|---|
| Laptop replacements | `lr` | Desktop Infrastructure | desktopinfrastructure@bcpcouncil.gov.uk | Fully specified, schema written |
| Smartphone replacements | `sr` | Governance & Compliance | ictgc@bcpcouncil.gov.uk | Only `sr.settings` so far |
| New starters | `ns` (later) | New starters team | – | Not started |
| Inactive Audit | – | – | – | Not started |

Laptop replacements replaces an Excel workbook plus twelve Power Automate flows. The full spec is `docs/laptop-replacement-spec.md`.

Quay is early: a design proof of concept going through approval phases. Its name follows on from **Harbour**, the council's existing public entry point for forms (also Next.js, on Azure App Service). Harbour had a question builder; Quay will need one too, so Harbour's version is the starting point for those requirements.

## Stack and decisions already made

- **Next.js** (App Router) with **TypeScript** (strict). `/app/api` mirrors the services, e.g. `/app/api/replacements/laptops/...`. Routes follow the mockups: `/my/...` for colleagues, `/manage/...` for the team (e.g. `/manage/replacements/laptops/cases`).
- **Tooling:** Biome for linting and formatting (Harbour's settings), Vitest + Testing Library + axe-core for tests (`tests/`), Storybook (`@storybook/nextjs-vite`, a11y addon set to fail on violations) with stories in `stories/`.
- **Every external call goes through a reusable client** (Halo, Microsoft Graph, Power Automate, decommission hook). No ad hoc `fetch` calls to these from routes or components. Server-side only; secrets never reach the client.
- **Auth:** Better Auth with its built-in Microsoft Entra ID provider (not Auth.js). SSO only, **cookie-only sessions**: no Better Auth tables, `portal.users` is the only user table. An Entra ID app registration is being raised with the security team. Until then `lib/auth/current-user.ts` is a stub returning a mock user.
- **Database:** PostgreSQL 16 on Azure Database for PostgreSQL Flexible Server, behind PgBouncer (transaction mode). Locally the same in Docker (`compose.yaml`, `npm run db:up`, `db:setup`, `db:migrate`, `db:seed`; `db:reset` rebuilds everything; see `db/README.md`). All database access goes through `lib/db` (`query`, `queryOne`, `withTransaction`, `describeConstraintError`); `date` columns come back as `YYYY-MM-DD` strings. Working-day rules are in `lib/dates/working-days.ts` (mirroring the SQL functions), bank holidays in `lib/clients/bank-holidays`, and today's London date and the dev "as if today is" override in `lib/clock.ts`. Plain SQL with `pg`, no ORM. Numbered migrations run by `db/scripts/migrate.mjs`. One database `quay` (renamed from the schema doc's `devices`, because Quay will hold more than the Device portal), one schema per service. Full schema: `docs/database-schema.md`. (Dataverse was considered and rejected.)
- **Hosting:** Azure App Service (Linux), like Harbour, deployed from the VS Code Azure Resources extension rather than CI/CD. **Don't use `output: 'standalone'`.** Harbour (`../bcp-fms`) deploys a zip with `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in `.deployment` so App Service builds it; expect the same here.
- **Emails:** the portal renders subject + HTML + text and POSTs them to one Power Automate flow that only sends. No logic or templates live in Power Automate.
- **Scheduled jobs:** timer-triggered calls (Azure Functions timer or a cron-triggered route) to secured, idempotent job endpoints. All 9am jobs run together.
- **Error tracking:** Azure Application Insights preferred (self-hosted GlitchTip as the alternative); not Sentry.
- **Build order:** interface first (likely in Storybook) against mock data, then wire in the real APIs.

## Frontend conventions

- GOV.UK Design System patterns throughout, WCAG 2.2 AA. Use real `<button>`, `<a href>`, `<label>`; error summaries; confirmation pages for anything that sends an email or can't be undone; red warning button for destructive actions.
- The team has its own component library, the **BCP Council Design System**, in Harbour: `../bcp-fms/components/ui`. It will be compared with the portal's components to form the final, expanded library, so build components so they can be swapped or merged. Every difference from Harbour goes in `docs/design-differences.md`.
- **Vanilla CSS with BCP-prefixed class names** in Harbour's format `bcp-[component]-[subname]--[child]` (e.g. `bcp-button--secondary`, `bcp-summary-list-row`). No Tailwind, no CSS Modules. Tokens live in `components/ui/bcp-design-system.css`.
- **Component structure (Harbour's standard):** one kebab-case folder per component holding exactly `index.tsx` and `<name>.css`, the CSS imported in `index.tsx`. Generic UI components in `components/ui/` (button, accordion, table, step list…); patterns that combine them in `components/patterns/` (filter panel, journal, lookup field, add another…), following the mockups' Components and Patterns pages; page frames in `components/layouts/`; service components grouped by service in `components/service/<service>/` (e.g. `replacements/type-tag`). Stories mirror this in `stories/` and Storybook (Components, Patterns, Service, Layouts); tests in `tests/`. Name components for what they are, not the service (StepList, not ReplacementSteps). Prefer server components; mark client components only when they need state.
- The team's Markdown library is Harbour's `components/ui/markdown`; use it (extended to output inline-styled email HTML and plain text) for page content, FAQs and email bodies rather than adding another.
- **The mockups canvas is the source of truth for visuals.** The Components page defines each component; where the Laptop replacements screens consistently differ, the screens win. Record contradictions in `docs/design-differences.md` rather than guessing.
- **Components in `components/ui/` are a design system:** generic props and tokens (Harbour's `Container`: `width="full"`, `contentWidth="half"`), never named after a page type or service. Page types live in `components/layouts/` (TeamLayout/TeamPage, ColleagueLayout/ColleaguePage), matching the mockups' page templates.
- Layout: team pages use the `full` container (1260px, 60px gutters, 20px on phones); colleague pages the `large` container (1100px) with one column up to 760px, question pages 680px. Pages with a sidebar use `SidebarLayout` (sidebar up to 320px), shown only when it has something to act on. Phones are `max-width: 640px`.
- The header shows the council logo only. The team header's Menu needs JavaScript; there is no no-JavaScript version.
- Long lists use a secondary "Show more" button with "Showing X of Y" (announced to screen readers, focus moves to the first new row) rather than pagination.
- Collection vs Session: blue "Collection" tag, purple "Session" tag, always colour plus the word.
- Colleague-facing pages say "software", never "business applications". Colleagues never see the case reference.

## Database rules that bite (PgBouncer transaction mode)

- Schema-qualify every table (`lr.cases`, `portal.users`). Never rely on `search_path`.
- No session features from the app: no `SET`, `LISTEN`, advisory locks or temp tables. The one exception is `SELECT set_config('portal.acting_user', $1, true)`, which is transaction-scoped.
- Multi-step writes go through one client in a `BEGIN`/`COMMIT` transaction.
- Normal parameterised queries (`$1`); never pass `name:` (named prepared statements).
- The app connects as `portal_app` on port 6432. Migrations connect as `portal_migrator` on port 5432 only.
- Never edit a migration that has run; add a new numbered file. New tables need no grants (default privileges cover them).
- Map constraint names in `err.constraint` to friendly messages (table in the schema doc).

## Core business rules (enforced server-side, in the service layer)

- **External calls first:** any action that calls Halo, the decommission hook or Power Automate makes the call before anything is saved. Success → write to the DB and journal, green success banner. Failure → nothing changes, red "Failed" banner with what failed and a link to the Connection log. Every call is written to `lr.connection_log`.
- Every change and every email writes a journal entry. Journal entries are never edited or deleted. Cases are never deleted; archiving is a date filter (one month after `closed_at`), not a status.
- Working days are Monday–Friday excluding England and Wales bank holidays (GOV.UK bank holidays feed, cached daily). Note `lr.add_working_days` in SQL only knows weekdays, so the app should pass bank-holiday-aware dates where it matters.
- In development, jobs can be run on demand with a "run as if today is" date; the app passes that date to queries rather than changing the database clock.

## Docs in this handoff

- `docs/laptop-replacement-spec.md` – the full service specification (exported 29 Oct 2026, rev 176). Source of truth for behaviour.
- `docs/database-schema.md` – schema working copy as of 28 Oct 2026: setup SQL, migrations 0001–0012, `migrate.mjs`, connection rules, scheduled jobs, error mapping.
- `docs/mockups.md` – where the screen mockups are and what's in them.
- `docs/design-differences.md` – how Quay's components differ from Harbour's, and why.

Decisions made after the handoff (29 Oct 2026), which override the spec and schema doc:

- Migrations 0001–0012 are copied exactly from the schema doc into `db/migrations/`; **0013** (`db/migrations/0013_steps_connections_and_fixes.sql`) holds the post-handoff changes: step completion columns (`device_prepared_at/by`, `software_prepared_at/by`), `lr.imports.file_name` nullable, no CHECK on `lr.connection_log.connection`, `lr.software.sort_order` dropped, `portal.connections` for URLs, `add_working_days(d, 0)` returning `d` plus a bank-holiday-aware 3-argument form, a `p_bank_holidays` parameter on `email_forecast`, and `portal_app` losing UPDATE/DELETE on `lr.journal_entries`, `lr.device_journal` and `portal.user_role_history` and DELETE on `lr.cases`. From here on `db/migrations/` is the source of truth for the schema, not the doc.
- **Connections:** URLs (webhook links, API base URLs) are in `portal.connections` and editable by Administrators; secrets are in `.env`. Each client declares its own connection name and logs every call through one shared connection logger.
- No per-user preferences: filters and columns live in the URL only, not "remembered per user".
- Journal stays in `lr` (`lr.journal_entries`).
- Session defaults: 10:00 for both types (the mockup's 09:30 for Session is out of date).
- The software list is always sorted alphabetically.
- "I am not available for any of these dates" moves the case to Unbooked with reminders paused.
- Case replacement steps are always open, with no Show/Hide or "Show all steps" (the spec's Show/Hide is out of date).
- Column choices on lists are not remembered: they live in the URL like the other filters.
- The mockups' Laptop replacements page is the most up-to-date source for screens.
- Weekly emails (booking, rebook and return reminders) go on their weekday; when that day is a bank holiday they go on the next working day. The 9am jobs and `lr.email_forecast` both decide this with `lr.is_weekly_send_day(day, weekday, bank_holidays)` (migration 0014), so the forecast matches what is sent.

Where the spec and schema disagree, the schema reflects later decisions (for example: flag at the 3rd reminder, session status `Full` is derived not stored, software arrays are `text[]` not `jsonb`, the case's person is `user_id` with `halo_assigned_user_id` for reference). Flag any other conflicts rather than guessing.

## Open questions (don't invent answers)

- Halo report, stock criteria and API details (Ben to provide)
- Whether the old device's Halo status changes when marked returned
- Whether removing a device from a case needs a reason
- Decommission hook endpoint, auth and payload (Ben to provide)
- BCP username format, and "Department" vs "Service area" on case pages

Build these behind interfaces with mock implementations so they can be filled in later.
