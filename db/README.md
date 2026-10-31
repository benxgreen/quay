# Database

PostgreSQL 16. The schema, connection rules and error mapping are in `docs/database-schema.md`. Migrations 0001–0012 are copied from that document exactly; 0013 onwards were written after it. The setup script is also copied, except that the database is called `quay`, not `devices`. Never edit a migration that has run: add the next numbered file.

| Path | What it is |
|---|---|
| `setup/00_roles_and_database.sql` | Creates `portal_migrator`, `portal_app`, `portal_readonly` and the `quay` database. Run once per environment. |
| `migrations/NNNN_*.sql` | Run in name order by `scripts/migrate.mjs`, each in its own transaction, recorded with a checksum in `public.schema_migrations`. |
| `scripts/migrate.mjs` | The migration runner. Connects as `portal_migrator` on port 5432 and refuses the PgBouncer port. |
| `scripts/setup-local.sh` | Runs the setup SQL against the local Docker Postgres. |
| `seed/dev.sql`, `seed/portal-email-template.html` | Development data, loaded by `scripts/seed-dev.mjs`. Never for a shared environment. |

## Migrations after the schema document

| Migration | What it does |
|---|---|
| 0013 | Step completion columns, `portal.connections` for links, bank-holiday-aware `add_working_days`, nullable import file name, and no UPDATE/DELETE on journals for `portal_app` |
| 0014 | `lr.is_weekly_send_day`: weekly emails move to the next working day after a bank holiday, in both the jobs and the forecast |
| 0015 | One `halo` connection, `portal.users.halo_user_id`, and `outcome` on journal entries for failed attempts |
| 0016 | `lr.halo_report`: the latest Halo end-of-life report for the Import screen |
| 0017 | `lr.halo_stock`: the latest Halo stock list |
| 0018 | `lr.job_runs` and `lr.job_run_cases`: the scheduled job log, which also keeps the jobs from sending twice |
| 0019 | One session per type at any start time |
| 0020 | The old device's make and model on each case |
| 0021 | The job log and connection log move to `portal` with a `service` column, for every service's jobs and calls |
| 0023 | Job title, department and manager's email read from `other2`, `other5` and `admanager`, the fields report 566 uses |
| 0024 | The username mapping and prefix leave the Halo settings: the username will come from Entra ID |
| 0025 | A `notification_webhook` connection for team notifications through Power Automate (not used yet); the email webhook is labelled "Email webhook" |
| 0026 | Audit notes use the service's shared variable names: `{full_name}` and `{case_reference}` instead of `{person}` and `{reference}` |
| 0022 | Halo settings: `portal.halo_settings` (staff field mapping) and `lr.halo_settings` (reports, asset type, statuses, fields, values and audit notes), started with the test Halo's values |

## Local database

Docker runs Postgres 16 (server timezone Europe/London) with PgBouncer in front in transaction mode, as on Azure (`compose.yaml`). Passwords are in `.env`; copy `.env.example` to start.

```bash
npm run db:up
```

```bash
npm run db:setup
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

- **Migrations** connect as `portal_migrator` straight to Postgres on `localhost:5432` (`MIGRATE_DATABASE_URL`).
- **The app** connects as `portal_app` through PgBouncer on `localhost:6432` (`DATABASE_URL`). Session features (`SET`, `LISTEN`, advisory locks, temp tables) behave as they would on Azure, so mistakes show up locally.
- `npm run db:reset` deletes the local data and rebuilds the database from scratch, seed included. `npm run db:down` stops the containers and keeps the data.

## Development data

`npm run db:seed` loads made-up data into an empty local database (it refuses anything but localhost, and a database that already has cases):

- 19 people: John Smith (Administrator and laptop team, the mock signed-in user) and Alex Morgan on the team, and colleagues named as in the mockups. Emails use the reserved `.test` domain, so nothing can reach a real inbox.
- 7 sessions relative to today: two in 2 working days, two in 8, one in 12, one in the past (closed) and one the team cancelled.
- 16 cases with at least one at every status, including the three kinds of flag, an availability request, a rebooking, a custom appointment, someone receiving a laptop for another person, and cases at each replacement step.
- Bookings, device allocations, checklist ticks, journal entries, connection log rows and email counts to match.
- The portal email template and the Session cancelled email, both from the mockups. The other eight emails are placeholders whose subject starts "[Wording to come]".

## Using the database from the app

`lib/db` is the only way the app talks to Postgres:

- `query` and `queryOne` for a single statement, and `withTransaction(work, { actingUserId })` for anything that writes more than one row. `actingUserId` sets `portal.acting_user` for that transaction only.
- `date` columns come back as `YYYY-MM-DD` strings, not JavaScript Dates.
- `describeConstraintError(error)` turns a rule the database enforced (a full session, a box already allocated…) into a sentence for the page.

Working days live in `lib/dates/working-days.ts` and match the SQL functions. Bank holidays come from `lib/clients/bank-holidays` (the GOV.UK feed, cached for a day). `lib/clock.ts` gives today's London date and the development "run as if today is" override.

Both ports listen on 127.0.0.1 only.
