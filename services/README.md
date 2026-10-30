# Services

Each service is one area of the portal run by one team, with its own database schema, roles, settings and emails. Laptop replacements (`lr`, Desktop Infrastructure) is built; smartphone replacements (`sr`) and new starters (`ns`) are planned.

Shared code lives in `lib/` and `components/`, and a service should use it rather than copy it. See the "Shared building blocks" table in the root README.

## What a service is made of

Using laptop replacements as the pattern:

| Part | Where |
|---|---|
| Business rules and queries | `services/replacements/laptops/lib/*.ts` (`cases.ts`, `booking.ts`, `steps.ts`, `statistics.ts`…). Every rule is enforced here, not only in a form. |
| External calls the service needs | `services/replacements/laptops/lib/halo` (requests to Halo through the shared `callHalo`), mock and real behind one interface |
| Emails | `services/replacements/laptops/lib/emails`: its email list, variables (with examples for the preview), sender and counts. Rendering and sending are shared (`lib/emails`). |
| Journal | `services/replacements/laptops/lib/journal.ts`, writing to the service's own `lr.journal_entries`; shown with the shared `Journal` pattern |
| Scheduled jobs | `services/replacements/laptops/lib/jobs`, run by `POST /api/replacements/laptops/jobs` |
| Navigation | `services/replacements/laptops/navigation.ts` (the service navigation and breadcrumbs) |
| Team pages | `app/manage/replacements/laptops/…` |
| Colleague pages | `app/my/replacements/laptop/…` |
| Components only this service family needs | `components/service/replacements/…` |
| Database | `db/migrations`, in the service's own schema (`lr`) |
| Access | Roles in `lib/portal/roles.ts` and the rules in `lib/portal/access.ts` |

## Adding a service

1. Add its schema and tables in a new numbered migration (never edit one that has run). Give it a settings table, journal table and, if it emails, templates and an email count table like `lr`'s.
2. Add its roles to `lib/portal/roles.ts` and its access rules to `lib/portal/access.ts`, and its pages to the Menu in `lib/portal/navigation.ts`.
3. Create `services/<family>/<service>/lib` for its rules and queries, and `navigation.ts` for its service navigation.
4. Build its pages under `app/manage/<family>/<service>` with the shared layouts, components and patterns. Settings pages can use `components/patterns/settings-form` and `components/patterns/email-editor`; connections and the portal email template are already shared.
5. If something you need would suit another service too, add it to `lib/` or `components/` without the service's name in it, with a story and tests.
6. Record decisions in `CLAUDE.md` and differences from the mockups in `docs/design-differences.md`.

## Shared logs

Every service's scheduled jobs and external calls are logged in the portal schema, tagged with the service: `portal.job_runs` and `portal.job_run_cases` (run with `runLogged` from `lib/jobs/runner.ts`), and `portal.connection_log` (written by `callExternal`; pass `service` in the call context, as laptop replacements' Halo client and `sendEmail` do). Each service shows its own rows. Connection links (`portal.connections`) are changed in laptop replacements' Settings, as they are its connections.
