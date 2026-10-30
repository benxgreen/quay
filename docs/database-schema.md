# Device portal database (Postgres)

Working copy of the schema as of 2026-10-28. Files: setup/00_roles_and_database.sql, migrations/0001–0012, scripts/migrate.mjs.



PostgreSQL 16 on Azure Database for PostgreSQL Flexible Server. There is one database, `devices`, with one schema per service.

| Schema   | What's in it |
|----------|--------------|
| `portal` | Shared: users, roles, helper functions |
| `lr`     | Laptop replacements |
| `sr`     | Smartphone replacements (only `sr.settings` so far: Governance & Compliance, sent from ictgc@bcpcouncil.gov.uk) |

## Roles

| Role              | Logs in | Used by                    | Can do |
|-------------------|---------|----------------------------|--------|
| `portal_migrator` | Yes     | `scripts/migrate.mjs` only | Owns every schema and table |
| `portal_app`      | Yes     | Next.js, through PgBouncer | Read and write rows only |
| `portal_readonly` | No      | Reporting                  | Read only |

## First-time setup (per environment)

1. Create the Flexible Server (PostgreSQL 16) and set these server parameters:
   - `timezone = Europe/London`
   - `pgbouncer.enabled = true`
2. As the Azure admin, on port **5432**:
   ```
   psql "host=<server>.postgres.database.azure.com port=5432 dbname=postgres user=<admin> sslmode=require" \
     -v migrator_pw="'<password>'" -v app_pw="'<password>'" \
     -f db/setup/00_roles_and_database.sql
   ```
3. Run the migrations as `portal_migrator`, on port **5432**:
   ```
   npm i pg
   MIGRATE_DATABASE_URL="postgres://portal_migrator:<pw>@<server>.postgres.database.azure.com:5432/devices?sslmode=require" \
     node db/scripts/migrate.mjs
   ```

## The app connection

The app connects as `portal_app` on port **6432** (PgBouncer):

```js
// lib/db.js
import pg from 'pg';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // ...:6432/devices?sslmode=require, user portal_app
  max: 10,
});
```

Rules that keep PgBouncer's transaction mode happy:

- **Write every table with its schema**, for example `lr.cases` or `portal.users`. Never rely on `SET search_path`, because the next query may run on a different server connection.
- **Don't use session features:** no `SET`, `LISTEN`, advisory locks or temporary tables from the app.
- **Use a transaction for anything multi-step.** For example, booking plus a journal entry plus a status change should go through one client:
  ```js
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // ...
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
  ```
- **Use `pg`'s normal parameterised queries** (`$1, $2`). They use unnamed prepared statements, which work through PgBouncer. Don't pass a `name:` option.

## Scheduled jobs

The app runs these jobs on a timer (Azure Functions or a cron-triggered route). None of them hold a session open, so they work through PgBouncer.

| Job | When | What it reads |
|-----|------|---------------|
| Send invitations | 9am each working day | `lr.settings.invitations_per_working_day` |
| Send booking reminders | 9am on `reminder_weekday` | `first_reminder_after_days`, `reminder_weekday`, `flag_after_reminders` |
| Send return reminders | 9am on `return_reminder_weekday` | `return_reminders_enabled`, `lr.cases.return_reminders` |
| Purge connection log | Daily | Calls `lr.purge_connection_log()`; rows older than 7 days are deleted |
| Send session reminders | 9am each working day | Bookings whose date is `software_lock_working_days` working days away |
| Purge email counts | Daily | Calls `lr.purge_email_sends()`; rows older than 13 months are deleted |

All the 9am jobs run together, so invitations and every kind of reminder go out at the same time.

Every email also writes a row to `lr.email_sends` (with `scheduled` true when the 9am job sent it). Settings › Emails › Emails each day reads `lr.emails_per_day` for what was sent and `lr.email_forecast(<today>)` for what the 9am job will send on the next 5 working days.

Every call to Halo or Power Automate writes a row to `lr.connection_log`. The Connection log page reads `lr.connection_log_recent`, so even before the purge runs it never shows anything older than 7 days.

In development, the jobs can be run on demand from Settings, with a "run as if today is" date passed in by the app. The database has no clock of its own beyond `now()`, so the app passes the date to its queries rather than the database being changed.

## Changing the schema

- Add a new numbered file in `migrations/`. Never edit one that has already run, because the runner checks a checksum and stops if it has changed.
- **New table:** nothing to grant. Default privileges give `portal_app` access automatically, as long as `portal_migrator` created it.
- **New status:** drop and re-add the CHECK constraint in a migration:
  ```sql
  ALTER TABLE lr.cases DROP CONSTRAINT cases_status_check;
  ALTER TABLE lr.cases ADD CONSTRAINT cases_status_check CHECK (status IN (...));
  ```

## Errors the app should catch

Each error the database raises below has a matching friendly message on the page.

| Constraint                        | Meaning | Show |
|-----------------------------------|---------|------|
| `sessions_not_overbooked`         | Someone took the last place | "That date has just filled up. Choose another." |
| `sessions_one_per_type_and_time`  | Same replacement type already has a session at that date and time | "There is already a session of this type at this date and time." |
| `bookings_session_open`           | Session was closed or cancelled | Same as above |
| `bookings_one_active_per_case`    | Case already has a booking | Send them to Rebook |
| `cases_one_open_per_device`       | Device already has an open case | Import "needs attention" |
| `cases_one_open_per_box`          | Box already allocated to another case | "That device is allocated to LR-…" |
| `bookings_session_type_matches`   | Collection case on a Session, or the reverse | Bug: shouldn't be reachable from the UI |

`err.constraint` holds the name for CHECK and unique errors. For the two raised from triggers, it's in `err.constraint` too, because they're raised with `USING CONSTRAINT`.

## setup/00_roles_and_database.sql

```sql
-- =====================================================================
-- 00_roles_and_database.sql
-- Run ONCE per environment, as the Azure admin user, connected to the
-- built-in "postgres" database on port 5432 (NOT the PgBouncer port 6432).
--
--   psql "host=<server>.postgres.database.azure.com port=5432 dbname=postgres \
--         user=<azure-admin> sslmode=require" \
--        -v migrator_pw="'...'" -v app_pw="'...'" \
--        -f setup/00_roles_and_database.sql
--
-- Roles:
--   portal_migrator  owns every schema, table and sequence. Only migrations
--                    log in as this role.
--   portal_app       what Next.js logs in as (via PgBouncer). Can read and
--                    write rows, cannot create, alter or drop anything.
--   portal_readonly  optional, for reporting / Power BI.
-- =====================================================================

CREATE ROLE portal_migrator LOGIN PASSWORD :migrator_pw;
CREATE ROLE portal_app      LOGIN PASSWORD :app_pw;
CREATE ROLE portal_readonly NOLOGIN;

-- The Azure admin is not a superuser. Since PostgreSQL 16 a role you create
-- is not automatically one you can act as, so grant membership explicitly
-- before handing ownership of the database over.
GRANT portal_migrator TO CURRENT_USER;

CREATE DATABASE devices OWNER portal_migrator;

-- Nobody gets in unless granted.
REVOKE ALL ON DATABASE devices FROM PUBLIC;
GRANT CONNECT ON DATABASE devices TO portal_app, portal_readonly;

-- Server parameters to set in the Azure portal (Server parameters blade):
--   timezone             = Europe/London
--   pgbouncer.enabled    = true
--   pgbouncer.pool_mode  = transaction   (the default)
-- No extensions are needed: gen_random_uuid() is built in.
```

## migrations/0001_schemas.sql

```sql
-- =====================================================================
-- 0001_schemas.sql — run as portal_migrator, connected to "devices"
--
-- One database, one schema per service:
--   portal  shared: users, roles, things every service uses
--   lr      laptop replacements
--   sr      smartphone replacements (tables added in a later migration)
--   ns      new starters (later)
--
-- Every object created from here on is owned by portal_migrator, so the
-- default privileges below give portal_app and portal_readonly access to
-- them automatically. This is the step that is usually missed: without it,
-- each new table needs its own GRANT or the app gets "permission denied".
-- =====================================================================

CREATE SCHEMA portal;
CREATE SCHEMA lr;
CREATE SCHEMA sr;

-- Stop anyone creating objects in "public" by accident.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- USAGE lets a role see inside a schema. Without it every query fails with
-- "permission denied for schema lr" even when table grants are correct.
GRANT USAGE ON SCHEMA portal, lr, sr TO portal_app, portal_readonly;

-- Future tables, sequences and functions created by portal_migrator.
-- (Default privileges only apply to objects created AFTER this runs, by
--  the role named in FOR ROLE — which is why ownership must stay with one role.)
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT USAGE, SELECT ON SEQUENCES TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT EXECUTE ON FUNCTIONS TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT SELECT ON TABLES TO portal_readonly;

-- Shared helper: keep updated_at current on every table that has one.
CREATE FUNCTION portal.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
```

## migrations/0002_portal.sql

```sql
-- =====================================================================
-- 0002_portal.sql — shared tables every service points at
-- =====================================================================

-- People, kept in step with Entra ID / the staff directory on sign-in.
CREATE TABLE portal.users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_object_id  uuid UNIQUE,                  -- oid claim from Entra ID
  email            text NOT NULL,
  display_name     text NOT NULL,
  username         text,                         -- e.g. bcp-cs\john.smith
  job_title        text,
  department       text,
  manager_id       uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive unique email without needing the citext extension.
CREATE UNIQUE INDEX users_email_key ON portal.users (lower(email));
CREATE INDEX users_manager_idx ON portal.users (manager_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON portal.users
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();

-- Portal roles. Text plus a CHECK rather than an enum type, so adding a
-- role later is a one-line constraint change instead of ALTER TYPE.
CREATE TABLE portal.user_roles (
  user_id     uuid NOT NULL REFERENCES portal.users (id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN (
                'administrator',        -- portal-wide, e.g. Connections
                'replacements_team',
                'replacements_admin',
                'new_starters_team'
              )),
  granted_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
```

## migrations/0003_lr.sql

```sql
-- =====================================================================
-- 0003_lr.sql — laptop replacements
--
-- Conventions
--   * Every name is schema-qualified (lr.cases, portal.users). Never rely
--     on search_path: PgBouncer in transaction mode does not keep SET
--     between queries.
--   * Choice lists are text + CHECK, not enum types, so adding a status
--     is ALTER TABLE ... DROP/ADD CONSTRAINT rather than ALTER TYPE.
--   * Times are timestamptz; set the server timezone to Europe/London.
--   * session_type is 'collection' or 'session' everywhere.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------

-- One row of typed settings rather than a key/value table, so every
-- setting has a real type, a default and a constraint.
CREATE TABLE lr.settings (
  id                          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  invitations_per_working_day integer  NOT NULL DEFAULT 15 CHECK (invitations_per_working_day > 0),
  first_reminder_after_days   integer  NOT NULL DEFAULT 21 CHECK (first_reminder_after_days >= 0),
  reminder_weekday            smallint NOT NULL DEFAULT 1  CHECK (reminder_weekday BETWEEN 1 AND 5), -- 1 = Monday
  flag_after_reminders        integer  NOT NULL DEFAULT 2  CHECK (flag_after_reminders >= 0),
  booking_lead_working_days   integer  NOT NULL DEFAULT 5  CHECK (booking_lead_working_days >= 0),
  software_lock_working_days  integer  NOT NULL DEFAULT 3  CHECK (software_lock_working_days >= 0),
  archive_after               interval NOT NULL DEFAULT '1 month',
  updated_by                  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO lr.settings DEFAULT VALUES;

CREATE TABLE lr.session_defaults (
  session_type  text PRIMARY KEY CHECK (session_type IN ('collection', 'session')),
  start_time    time    NOT NULL,
  capacity      integer NOT NULL CHECK (capacity > 0),
  location      text    NOT NULL,
  updated_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Software shown as checkboxes. Bookings store the NAMES they picked, so
-- renaming or removing an item never rewrites history.
CREATE TABLE lr.software (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  hint        text,                                -- shown under the checkbox
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX software_name_key ON lr.software (lower(name));

-- Device preparation checks (step 2) and decommission checklist (step 6).
-- Never deleted: set active = false so old case copies still make sense.
CREATE TABLE lr.checklist_items (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list        text NOT NULL CHECK (list IN ('device_preparation', 'decommission')),
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

-- Markdown shown on the colleague's page, one per session type.
CREATE TABLE lr.page_content (
  session_type  text PRIMARY KEY CHECK (session_type IN ('collection', 'session')),
  body_markdown text NOT NULL DEFAULT '',
  updated_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lr.faqs (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question         text NOT NULL,
  answer_markdown  text NOT NULL,
  shown_for        text[] NOT NULL
                   CHECK (cardinality(shown_for) > 0
                          AND shown_for <@ ARRAY['collection', 'session']),
  sort_order       integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  updated_by       uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Devices replaced before the portal (from the old workbook), used by the
-- import screen's "replaced before" check.
CREATE TABLE lr.previous_replacements (
  old_asset_id  text PRIMARY KEY,
  old_serial    text,
  completed_on  date
);


-- ---------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------

CREATE TABLE lr.sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_type  text    NOT NULL CHECK (session_type IN ('collection', 'session')),
  starts_at     timestamptz NOT NULL,
  capacity      integer NOT NULL CHECK (capacity > 0),
  location      text    NOT NULL,
  status        text    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'cancelled')),
  -- Kept up to date by the trigger on lr.bookings. "Full" is
  -- booked_count = capacity; there is no Full status to keep in sync.
  booked_count  integer NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- The overbooking guard. Two people booking the last place at once:
  -- the second UPDATE waits for the first, then fails this check.
  CONSTRAINT sessions_not_overbooked CHECK (booked_count BETWEEN 0 AND capacity)
);
CREATE INDEX sessions_starts_at_idx ON lr.sessions (starts_at);

CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON lr.sessions
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();


-- ---------------------------------------------------------------------
-- Imports and cases
-- ---------------------------------------------------------------------

CREATE TABLE lr.imports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name    text NOT NULL,
  imported_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  rows_total   integer NOT NULL DEFAULT 0,
  rows_queued  integer NOT NULL DEFAULT 0
);

CREATE TABLE lr.cases (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference          text GENERATED ALWAYS AS ('LR-' || lpad(id::text, 6, '0')) STORED,

  -- People. The case is always against the assigned user in Halo; the
  -- recipient is only set when someone else is receiving the laptop.
  user_id            uuid NOT NULL REFERENCES portal.users (id),
  recipient_user_id  uuid REFERENCES portal.users (id),

  session_type       text NOT NULL CHECK (session_type IN ('collection', 'session')),
  status             text NOT NULL DEFAULT 'queued' CHECK (status IN (
                       'queued', 'pending', 'unbooked', 'booked', 'rebook_required',
                       'awaiting_return', 'awaiting_decommission',
                       'completed', 'withdrawn')),

  -- Old device, from the Halo report.
  old_asset_id       text NOT NULL,
  old_serial         text,
  old_hostname       text,
  old_make           text,
  old_model          text,

  -- Replacement device: Halo asset ID of the allocated box.
  box_number         text,
  software_prepared  text[] NOT NULL DEFAULT '{}',

  -- Invitations and reminders.
  import_id          bigint REFERENCES lr.imports (id) ON DELETE SET NULL,
  queued_at          timestamptz NOT NULL DEFAULT now(),
  invited_at         timestamptz,
  reminders_sent     integer NOT NULL DEFAULT 0 CHECK (reminders_sent >= 0),
  last_reminder_at   timestamptz,
  reminders_paused   boolean NOT NULL DEFAULT false,  -- true while an availability request is open

  -- Flag. NULL kind = not flagged.
  flag_kind          text CHECK (flag_kind IN ('reminders', 'manual', 'unavailable')),
  flag_reason        text,
  flagged_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL = system
  flagged_at         timestamptz,

  -- Progress.
  rebook_requested_at       timestamptz,
  attended_at               timestamptz,
  old_device_returned_at    timestamptz,
  old_device_returned_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  return_reminders          boolean NOT NULL DEFAULT true,
  decommissioned_at         timestamptz,
  decommissioned_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  closed_at                 timestamptz,   -- completed or withdrawn; archiving works from this
  withdrawn_reason          text,

  -- Only a hash of the emailed booking link token is stored.
  booking_token_hash text,

  created_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cases_flag_complete
    CHECK ((flag_kind IS NULL) = (flagged_at IS NULL)),
  CONSTRAINT cases_closed_at_matches_status
    CHECK ((status IN ('completed', 'withdrawn')) = (closed_at IS NOT NULL)),
  CONSTRAINT cases_withdrawn_needs_reason
    CHECK (status <> 'withdrawn' OR withdrawn_reason IS NOT NULL),
  CONSTRAINT cases_recipient_differs
    CHECK (recipient_user_id IS NULL OR recipient_user_id <> user_id)
);

-- One open case per old device.
CREATE UNIQUE INDEX cases_one_open_per_device
  ON lr.cases (old_asset_id) WHERE status NOT IN ('completed', 'withdrawn');
-- A replacement box can only be allocated to one open case.
CREATE UNIQUE INDEX cases_one_open_per_box
  ON lr.cases (box_number) WHERE box_number IS NOT NULL AND status NOT IN ('completed', 'withdrawn');

CREATE INDEX cases_status_idx    ON lr.cases (status);
CREATE INDEX cases_user_idx      ON lr.cases (user_id);
CREATE INDEX cases_recipient_idx ON lr.cases (recipient_user_id);
CREATE INDEX cases_flagged_idx   ON lr.cases (flagged_at) WHERE flag_kind IS NOT NULL;
CREATE INDEX cases_closed_idx    ON lr.cases (closed_at);

CREATE TRIGGER cases_updated_at BEFORE UPDATE ON lr.cases
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();


-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------

-- A booking is either a place on a published session, or a custom
-- appointment with its own time and location (session_id NULL).
CREATE TABLE lr.bookings (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  session_id          bigint REFERENCES lr.sessions (id),
  custom_starts_at    timestamptz,
  custom_location     text,
  custom_note         text,              -- added to the confirmation email
  status              text NOT NULL DEFAULT 'booked' CHECK (status IN (
                        'booked', 'rebooked', 'cancelled',
                        'did_not_attend', 'unsuccessful', 'attended')),
  software_requested  text[] NOT NULL DEFAULT '{}',
  software_changed_at timestamptz,
  booked_by           uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL = the colleague
  replaces_booking_id bigint REFERENCES lr.bookings (id),
  reason              text,              -- cancelled / did not attend / unsuccessful
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_session_or_custom CHECK (
    (session_id IS NOT NULL AND custom_starts_at IS NULL AND custom_location IS NULL)
    OR
    (session_id IS NULL AND custom_starts_at IS NOT NULL AND custom_location IS NOT NULL)
  )
);

-- Only one live booking per case.
CREATE UNIQUE INDEX bookings_one_active_per_case
  ON lr.bookings (case_id) WHERE status = 'booked';
CREATE INDEX bookings_session_idx ON lr.bookings (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX bookings_custom_idx  ON lr.bookings (custom_starts_at) WHERE session_id IS NULL;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();

-- Before a booking lands on a session: the session must be open and of
-- the same type as the case.
CREATE FUNCTION lr.bookings_check_session() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  s_type   text;
  s_status text;
  c_type   text;
BEGIN
  IF NEW.session_id IS NULL OR NEW.status <> 'booked' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
                      AND OLD.status = 'booked' THEN
    RETURN NEW;
  END IF;

  SELECT session_type, status INTO s_type, s_status FROM lr.sessions WHERE id = NEW.session_id;
  SELECT session_type INTO c_type FROM lr.cases WHERE id = NEW.case_id;

  IF s_status <> 'open' THEN
    RAISE EXCEPTION 'Session % is not open', NEW.session_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_session_open';
  END IF;
  IF s_type <> c_type THEN
    RAISE EXCEPTION 'Session % is a %, but case % is a %', NEW.session_id, s_type, NEW.case_id, c_type
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_session_type_matches';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_check_session BEFORE INSERT OR UPDATE OF session_id, status ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION lr.bookings_check_session();

-- After any change, keep lr.sessions.booked_count right. If the session
-- is full, the +1 breaks sessions_not_overbooked and the whole booking
-- transaction rolls back.
CREATE FUNCTION lr.bookings_sync_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'booked' AND OLD.session_id IS NOT NULL THEN
    UPDATE lr.sessions SET booked_count = booked_count - 1 WHERE id = OLD.session_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'booked' AND NEW.session_id IS NOT NULL THEN
    UPDATE lr.sessions SET booked_count = booked_count + 1 WHERE id = NEW.session_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER bookings_sync_count AFTER INSERT OR UPDATE OF session_id, status OR DELETE ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION lr.bookings_sync_count();


-- ---------------------------------------------------------------------
-- Availability requests ("I cannot attend any of these dates")
-- ---------------------------------------------------------------------

CREATE TABLE lr.availability_requests (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  reason              text NOT NULL CHECK (reason IN ('non_standard_hours', 'away_for_all_dates', 'other')),
  availability        text NOT NULL,
  software_requested  text[] NOT NULL DEFAULT '{}',
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  resolution          text CHECK (resolution IN ('custom_booking', 'session_booking', 'reinvited', 'withdrawn')),
  CONSTRAINT availability_resolved_complete
    CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);
-- At most one open request per case.
CREATE UNIQUE INDEX availability_one_open_per_case
  ON lr.availability_requests (case_id) WHERE resolved_at IS NULL;


-- ---------------------------------------------------------------------
-- Case checks (the case's own copy of a checklist)
-- ---------------------------------------------------------------------

CREATE TABLE lr.case_checks (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id            bigint  NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  step               text    NOT NULL CHECK (step IN ('device_preparation', 'decommission')),
  checklist_item_id  integer REFERENCES lr.checklist_items (id) ON DELETE SET NULL,
  label              text    NOT NULL,   -- wording as copied
  sort_order         integer NOT NULL,
  ticked             boolean NOT NULL DEFAULT false,
  ticked_by          uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  ticked_at          timestamptz,
  UNIQUE (case_id, step, sort_order),
  CONSTRAINT case_checks_tick_complete CHECK (ticked = (ticked_at IS NOT NULL))
);

-- Copy the active items onto a case when it reaches step 2 or step 6.
-- Calling it twice does nothing the second time.
CREATE FUNCTION lr.copy_checklist(p_case_id bigint, p_step text) RETURNS integer
LANGUAGE sql AS $$
  WITH ins AS (
    INSERT INTO lr.case_checks (case_id, step, checklist_item_id, label, sort_order)
    SELECT p_case_id, p_step, i.id, i.label,
           row_number() OVER (ORDER BY i.sort_order, i.id)
    FROM lr.checklist_items i
    WHERE i.list = p_step AND i.active
      AND NOT EXISTS (SELECT 1 FROM lr.case_checks c
                      WHERE c.case_id = p_case_id AND c.step = p_step)
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins;
$$;


-- ---------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------

CREATE TABLE lr.journal_entries (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id       bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  actor_system  text,                 -- e.g. 'Send booking reminders'
  kind          text NOT NULL CHECK (kind IN (
                  'note', 'status', 'email', 'booking', 'flag',
                  'allocation', 'checklist', 'software', 'availability', 'import')),
  body          text NOT NULL,        -- the sentence shown in the journal
  data          jsonb,                -- structured detail, e.g. email template and recipient
  CONSTRAINT journal_has_actor CHECK (actor_user_id IS NOT NULL OR actor_system IS NOT NULL)
);
CREATE INDEX journal_case_idx ON lr.journal_entries (case_id, occurred_at DESC);
```

## migrations/0004_lr_seed.sql

```sql
-- =====================================================================
-- 0004_lr_seed.sql — starting configuration (all editable in Settings)
-- =====================================================================

INSERT INTO lr.session_defaults (session_type, start_time, capacity, location) VALUES
  ('collection', '10:00', 10, 'Room 310, BCP Council Civic Centre, Bournemouth'),
  ('session',    '10:00',  5, 'Room 310, BCP Council Civic Centre, Bournemouth');

INSERT INTO lr.software (name, hint, sort_order) VALUES
  ('Adobe Acrobat Pro', 'Used for editing and signing PDFs. This software requires a licence.', 1),
  ('ArcGIS Pro',        'Used by people working in GIS. This software requires a licence.', 2),
  ('AutoCAD LT',        'Used for technical and architectural drawings. This software requires a licence.', 3),
  ('Microsoft Project', 'Used for planning and tracking projects. This software requires a licence.', 4),
  ('Microsoft Visio',   'Used for diagrams, flowcharts and floor plans. This software requires a licence.', 5),
  ('SPSS Statistics',   'Used for statistical analysis. This software requires a licence.', 6);

INSERT INTO lr.checklist_items (list, label, sort_order) VALUES
  ('device_preparation', 'Primary user changed to the colleague in Intune', 1),
  ('device_preparation', 'Windows and driver updates installed', 2),
  ('device_preparation', 'Device shows as compliant in Intune', 3),
  ('device_preparation', 'BitLocker enabled and recovery key escrowed', 4),
  ('decommission',       'Removed from Intune', 1),
  ('decommission',       'Removed from Entra ID', 2),
  ('decommission',       'BitLocker recovery key archived', 3),
  ('decommission',       'Drive securely wiped', 4),
  ('decommission',       'Asset label removed', 5),
  ('decommission',       'Placed in the disposal store', 6);

INSERT INTO lr.page_content (session_type, body_markdown) VALUES
  ('session', E'## Before your session\n\nWe will email you a reminder 3 working days before your session. Before then:\n\n- move anything you need to keep from your Downloads folder into your Documents folder, which is synced with OneDrive – files left in Downloads will not be moved to your new laptop\n- make a note of your username, **{username}** – you will need it to sign in to your new laptop\n\n## On the day\n\nYou will need to bring:\n\n- your current laptop\n- its charger\n- your laptop bag, if you have one'),
  ('collection', '');

INSERT INTO lr.faqs (question, answer_markdown, shown_for, sort_order) VALUES
  ('How long does it take?', 'Your session takes about 1 hour. You can go back to work with your new laptop straight after.', '{session}', 1),
  ('How long does it take?', 'Collecting your laptop takes about 10 minutes.', '{collection}', 2),
  ('Will my files move to my new laptop?', 'Files saved in OneDrive, including your Documents folder, will be there when you sign in. Files in your Downloads folder will not be moved.', '{session,collection}', 3),
  ('Can I keep using my old laptop until my session?', 'Yes. Keep using it as normal and bring it with you on the day.', '{session}', 4),
  ('What happens to my old laptop?', 'We securely wipe it and then recycle it.', '{session,collection}', 5),
  ('What if I cannot make my session?', 'Rebook onto another date using the Rebook link above. You cannot cancel your booking.', '{session,collection}', 6);
```

## migrations/0005_lr_stock_history.sql

```sql
-- =====================================================================
-- 0005_lr_stock_history.sql — allocation history and a journal per device
--
-- Stock itself is still read live from Halo. The portal records what it
-- did with each box: every allocation to a case, when it was removed and
-- why, and free-text notes. lr.cases.box_number stays as the "current
-- box" shortcut; lr.device_allocations is the full history.
-- =====================================================================

CREATE TABLE lr.device_allocations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  box_number      text   NOT NULL,                 -- Halo asset ID of the replacement device
  case_id         bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  allocated_at    timestamptz NOT NULL DEFAULT now(),
  allocated_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  removed_at      timestamptz,
  removed_by      uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  outcome         text CHECK (outcome IN ('issued', 'unallocated', 'case_withdrawn')),
  removed_reason  text,
  CONSTRAINT device_allocations_removed_complete
    CHECK ((removed_at IS NULL) = (outcome IS NULL))
);
-- A box can only be on one case at a time, and a case can only hold one box.
CREATE UNIQUE INDEX device_allocations_one_open_per_box
  ON lr.device_allocations (box_number) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX device_allocations_one_open_per_case
  ON lr.device_allocations (case_id) WHERE removed_at IS NULL;
CREATE INDEX device_allocations_box_idx ON lr.device_allocations (box_number, allocated_at DESC);

CREATE TABLE lr.device_journal (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  box_number    text NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  actor_system  text,                       -- e.g. 'Refresh stock from Halo'
  kind          text NOT NULL CHECK (kind IN ('note', 'allocation', 'stock')),
  case_id       bigint REFERENCES lr.cases (id) ON DELETE SET NULL,
  body          text NOT NULL,
  CONSTRAINT device_journal_has_actor CHECK (actor_user_id IS NOT NULL OR actor_system IS NOT NULL)
);
CREATE INDEX device_journal_box_idx ON lr.device_journal (box_number, occurred_at DESC);
```

## migrations/0006_lr_case_checks_box.sql

```sql
-- =====================================================================
-- 0006_lr_case_checks_box.sql — tie device preparation checks to the box
--
-- Device preparation checks belong to a specific device. When a device is
-- unallocated, its checks are cleared and the next box starts afresh.
-- Recording the box on each check keeps that history clear. Decommission
-- checks are about the OLD device, so they leave box_number empty.
-- =====================================================================

ALTER TABLE lr.case_checks ADD COLUMN box_number text;

ALTER TABLE lr.case_checks
  ADD CONSTRAINT case_checks_prep_has_box
  CHECK (step <> 'device_preparation' OR box_number IS NOT NULL);

-- The old "one row per position" rule would block a fresh set of checks
-- for a second box, so scope it to the box.
ALTER TABLE lr.case_checks DROP CONSTRAINT case_checks_case_id_step_sort_order_key;
CREATE UNIQUE INDEX case_checks_position_key
  ON lr.case_checks (case_id, step, coalesce(box_number, ''), sort_order);

-- copy_checklist now takes the box for step 2.
DROP FUNCTION lr.copy_checklist(bigint, text);
CREATE FUNCTION lr.copy_checklist(p_case_id bigint, p_step text, p_box_number text DEFAULT NULL)
RETURNS integer
LANGUAGE sql AS $$
  WITH ins AS (
    INSERT INTO lr.case_checks (case_id, step, box_number, checklist_item_id, label, sort_order)
    SELECT p_case_id, p_step, p_box_number, i.id, i.label,
           row_number() OVER (ORDER BY i.sort_order, i.id)
    FROM lr.checklist_items i
    WHERE i.list = p_step AND i.active
      AND NOT EXISTS (SELECT 1 FROM lr.case_checks c
                      WHERE c.case_id = p_case_id AND c.step = p_step
                        AND c.box_number IS NOT DISTINCT FROM p_box_number)
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins;
$$;
```

## migrations/0007_lr_case_person.sql

```sql
-- =====================================================================
-- 0007_lr_case_person.sql — the case is in the name of the person it's for
--
-- lr.cases.user_id is the person the case is for: the case name shown
-- everywhere, and who gets invitations and booking emails. This is the
-- person the device is listed against in the portal, which isn't
-- necessarily the Halo device allocation.
-- lr.cases.halo_assigned_user_id is the device's assigned user in Halo,
-- kept for reference. It's usually the same person, and is different when
-- someone else is receiving the laptop.
-- =====================================================================

ALTER TABLE lr.cases DROP CONSTRAINT cases_recipient_differs;
ALTER TABLE lr.cases RENAME COLUMN recipient_user_id TO halo_assigned_user_id;
ALTER INDEX lr.cases_recipient_idx RENAME TO cases_halo_assigned_idx;

COMMENT ON COLUMN lr.cases.user_id IS
  'Person the case is for: the case name and who receives emails. Not necessarily the Halo assigned user.';
COMMENT ON COLUMN lr.cases.halo_assigned_user_id IS
  'Assigned user of the old device in Halo, for reference.';
```

## migrations/0008_lr_session_cancel.sql

```sql
-- =====================================================================
-- 0008_lr_session_cancel.sql — record why and when a session was cancelled
--
-- The reason is internal: it is shown on the session and written to each
-- affected case's journal, and is never included in emails.
-- =====================================================================

ALTER TABLE lr.sessions
  ADD COLUMN cancelled_at     timestamptz,
  ADD COLUMN cancelled_by     uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  ADD COLUMN cancelled_reason text;

ALTER TABLE lr.sessions
  ADD CONSTRAINT sessions_cancelled_complete
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL));
```

## migrations/0009_lr_reminder_settings_and_connection_log.sql

```sql
-- =====================================================================
-- 0009_lr_reminder_settings_and_connection_log.sql
--
-- 1. Return reminder settings. The old device return reminders get their
--    own weekday and an on/off switch, separate from booking reminders.
--
-- 2. Connection log. One row for every call the portal makes to Halo or
--    Power Automate: what was called, what triggered it, which case it was
--    for and whether it worked. Shown on Settings › Connection log.
--
--    Rows expire after 7 days. The app's daily job calls
--    lr.purge_connection_log() to delete them (or schedule it with pg_cron
--    on the Flexible Server). Expiry is enforced at read time too: the
--    lr.connection_log_recent view only ever returns the last 7 days.
--
--    The links themselves are secrets and are not stored here.
-- =====================================================================

ALTER TABLE lr.settings
  ADD COLUMN return_reminders_enabled boolean  NOT NULL DEFAULT true,
  ADD COLUMN return_reminder_weekday  smallint NOT NULL DEFAULT 1
    CHECK (return_reminder_weekday BETWEEN 1 AND 5);           -- 1 = Monday

COMMENT ON COLUMN lr.settings.first_reminder_after_days IS
  'Days after the invitation before the first reminder. The reminder is sent on the next reminder_weekday after that.';
COMMENT ON COLUMN lr.settings.reminder_weekday IS
  'Weekday booking reminders are sent on, 1 = Monday to 5 = Friday.';

CREATE TABLE lr.connection_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  connection     text NOT NULL CHECK (connection IN
                   ('halo_import', 'halo_stock', 'decommission_hook', 'email_webhook')),
  trigger_kind   text NOT NULL CHECK (trigger_kind IN ('schedule', 'user', 'system')),
  trigger_label  text NOT NULL,          -- e.g. 'Daily invitations', 'Session cancelled email', 'Refresh from Halo'
  actor_user_id  uuid   REFERENCES portal.users (id) ON DELETE SET NULL,  -- set when trigger_kind = 'user'
  case_id        bigint REFERENCES lr.cases (id)     ON DELETE SET NULL,
  outcome        text NOT NULL CHECK (outcome IN ('success', 'failed')),
  status_code    integer,
  summary        text,                   -- e.g. '64 laptops', '15 sent'
  error          text,                   -- only when failed
  duration_ms    integer CHECK (duration_ms >= 0),
  CONSTRAINT connection_log_user_has_actor
    CHECK (trigger_kind <> 'user' OR actor_user_id IS NOT NULL),
  CONSTRAINT connection_log_error_only_when_failed
    CHECK (outcome = 'failed' OR error IS NULL)
);
CREATE INDEX connection_log_time_idx ON lr.connection_log (occurred_at DESC);
CREATE INDEX connection_log_connection_idx ON lr.connection_log (connection, occurred_at DESC);
CREATE INDEX connection_log_case_idx ON lr.connection_log (case_id) WHERE case_id IS NOT NULL;

COMMENT ON TABLE lr.connection_log IS
  'Calls to Halo and Power Automate. Rows expire after 7 days; see lr.purge_connection_log().';

-- What the Connection log page reads.
CREATE VIEW lr.connection_log_recent AS
  SELECT * FROM lr.connection_log
  WHERE occurred_at >= now() - interval '7 days';

-- "Last used" on Settings › Connections. NULL means not used in the last 7 days.
CREATE VIEW lr.connection_last_used AS
  SELECT connection, max(occurred_at) AS last_used_at
  FROM lr.connection_log_recent
  GROUP BY connection;

-- Deletes expired rows and returns how many went.
CREATE FUNCTION lr.purge_connection_log()
RETURNS integer
LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM lr.connection_log
    WHERE occurred_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;
```

## migrations/0010_portal_users_on_demand.sql

```sql
-- =====================================================================
-- 0010_portal_users_on_demand.sql — users are created when needed
--
-- The Users page lists everyone in the staff directory, read live from
-- Entra ID (Microsoft Graph). Nobody is imported up front. A row in
-- portal.users is created only when something happens for that person:
--   sign_in       they sign in to the portal for the first time
--   case          they are added to a case (import, Add a case, receiver)
--   role_granted  someone saves a role for them on the Users page
--
-- Create the row with INSERT ... ON CONFLICT (entra_object_id) DO UPDATE,
-- so whichever of these happens first wins and the others just update it.
--
-- Role changes are recorded in portal.user_role_history for the
-- "Role history" list on each user.
-- =====================================================================

ALTER TABLE portal.users
  ADD COLUMN created_via        text NOT NULL DEFAULT 'sign_in'
    CHECK (created_via IN ('sign_in', 'case', 'role_granted')),
  ADD COLUMN created_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL when created by their own sign-in or by the system
  ADD COLUMN last_signed_in_at  timestamptz;

COMMENT ON COLUMN portal.users.created_via IS
  'What first created this user: their own sign-in, being added to a case, or being given a role.';

CREATE TABLE portal.user_role_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES portal.users (id) ON DELETE CASCADE,
  role        text NOT NULL,
  change      text NOT NULL CHECK (change IN ('added', 'removed')),
  changed_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_role_history_user_idx ON portal.user_role_history (user_id, changed_at DESC);

-- Keep the history automatically, whichever code path changes a role.
-- The app sets portal.acting_user for the transaction with
--   SELECT set_config('portal.acting_user', $1, true)
-- which is transaction-scoped, so it is safe through PgBouncer.
CREATE FUNCTION portal.user_roles_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := nullif(current_setting('portal.acting_user', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO portal.user_role_history (user_id, role, change, changed_by)
    VALUES (NEW.user_id, NEW.role, 'added', coalesce(actor, NEW.granted_by));
    RETURN NEW;
  ELSE
    INSERT INTO portal.user_role_history (user_id, role, change, changed_by)
    VALUES (OLD.user_id, OLD.role, 'removed', actor);
    RETURN OLD;
  END IF;
END $$;

CREATE TRIGGER user_roles_history AFTER INSERT OR DELETE ON portal.user_roles
  FOR EACH ROW EXECUTE FUNCTION portal.user_roles_history();
```

## migrations/0011_roles_and_emails.sql

```sql
-- =====================================================================
-- 0011_roles_and_emails.sql
--
-- 1. Roles per service. Laptop replacements are run by Desktop
--    Infrastructure and smartphone replacements by Governance &
--    Compliance, so each service has its own team and admin role.
--    The old replacements_* roles become the laptop roles.
--
-- 2. Emails.
--    portal.email_template  the HTML every email is sent in. {content}
--                           is where the email goes; {preheader} and
--                           {team_name} are filled in when it is sent.
--    lr.email_templates     one row per laptop replacement email: subject,
--                           preheader and Markdown message.
--    lr.settings            the team name and the mailbox emails are sent
--                           from.
--    The portal renders the final subject and HTML and posts them to the
--    one Power Automate flow, which only sends.
-- =====================================================================

-- 1. Roles ------------------------------------------------------------

ALTER TABLE portal.user_roles DROP CONSTRAINT user_roles_role_check;

UPDATE portal.user_roles SET role = 'laptops_team'  WHERE role = 'replacements_team';
UPDATE portal.user_roles SET role = 'laptops_admin' WHERE role = 'replacements_admin';
UPDATE portal.user_role_history SET role = 'laptops_team'  WHERE role = 'replacements_team';
UPDATE portal.user_role_history SET role = 'laptops_admin' WHERE role = 'replacements_admin';

ALTER TABLE portal.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (
  'administrator',       -- portal-wide: Portal settings, Users, Connections
  'laptops_team',        -- Desktop Infrastructure
  'laptops_admin',
  'smartphones_team',    -- Governance & Compliance
  'smartphones_admin',
  'new_starters_team'
));

-- 2. Emails -----------------------------------------------------------

CREATE TABLE portal.email_template (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  html        text NOT NULL CHECK (position('{content}' IN html) > 0),
  updated_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lr.settings
  ADD COLUMN team_name  text NOT NULL DEFAULT 'Desktop Infrastructure',
  ADD COLUMN sent_from  text NOT NULL DEFAULT 'desktopinfrastructure@bcpcouncil.gov.uk'
    CHECK (sent_from LIKE '%@%');

CREATE TABLE lr.email_templates (
  key            text PRIMARY KEY CHECK (key IN (
                   'invitation', 'booking_reminder', 'booking_confirmed',
                   'session_reminder', 'session_cancelled', 'rebook_needed',
                   'availability_received', 'device_issued', 'return_reminder')),
  subject        text NOT NULL,
  preheader      text NOT NULL DEFAULT '' CHECK (char_length(preheader) <= 90),
  body_markdown  text NOT NULL,
  updated_by     uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

## migrations/0012_mailboxes_flag_and_email_counts.sql

```sql
-- =====================================================================
-- 0012_mailboxes_flag_and_email_counts.sql
--
-- 1. Smartphone replacements settings. Run by Governance & Compliance,
--    who send from ictgc@bcpcouncil.gov.uk. Only the email settings for
--    now; the rest of sr comes with the smartphone tables.
--
-- 2. Flag threshold. Settings shows "Flag case after 3 reminders", so
--    flag_after_reminders is now the reminder count that raises the flag
--    (flag when reminders_sent reaches it). Same behaviour as before
--    ("above 2"), clearer number.
--
-- 3. Emails each day (Settings › Emails › Emails each day).
--    lr.email_sends    one row per email sent or attempted. Kept 13 months.
--    lr.emails_per_day what was sent each day, split by kind.
--    lr.email_forecast what the 9am job will send on the next working days.
--    Invitations and reminders all go out together at 9am.
-- =====================================================================

-- 1. Smartphone replacements -------------------------------------------

CREATE TABLE sr.settings (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  team_name   text NOT NULL DEFAULT 'Governance & Compliance',
  sent_from   text NOT NULL DEFAULT 'ictgc@bcpcouncil.gov.uk' CHECK (sent_from LIKE '%@%'),
  updated_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sr.settings DEFAULT VALUES;

-- 2. Flag threshold ----------------------------------------------------

UPDATE lr.settings SET flag_after_reminders = flag_after_reminders + 1;
ALTER TABLE lr.settings ALTER COLUMN flag_after_reminders SET DEFAULT 3;
ALTER TABLE lr.settings DROP CONSTRAINT settings_flag_after_reminders_check;
ALTER TABLE lr.settings ADD CONSTRAINT settings_flag_after_reminders_check
  CHECK (flag_after_reminders >= 1);
COMMENT ON COLUMN lr.settings.flag_after_reminders IS
  'A case is flagged when reminders_sent reaches this number.';

-- 3. Emails each day ---------------------------------------------------

CREATE TABLE lr.email_sends (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_key          text NOT NULL CHECK (email_key IN (
                       'invitation', 'booking_reminder', 'booking_confirmed',
                       'session_reminder', 'session_cancelled', 'rebook_needed',
                       'availability_received', 'device_issued', 'return_reminder')),
  case_id            bigint REFERENCES lr.cases (id) ON DELETE SET NULL,
  to_address         text NOT NULL,
  scheduled          boolean NOT NULL,   -- true when sent by the 9am job, false when sent because something happened
  outcome            text NOT NULL CHECK (outcome IN ('sent', 'failed')),
  sent_at            timestamptz NOT NULL DEFAULT now(),
  connection_log_id  bigint REFERENCES lr.connection_log (id) ON DELETE SET NULL  -- gone after 7 days
);
CREATE INDEX email_sends_time_idx ON lr.email_sends (sent_at DESC);
CREATE INDEX email_sends_case_idx ON lr.email_sends (case_id) WHERE case_id IS NOT NULL;

COMMENT ON TABLE lr.email_sends IS
  'One row per email the portal asked Power Automate to send. Kept 13 months; see lr.purge_email_sends().';

-- "Sent in the last 5 working days" and the Today tile.
CREATE VIEW lr.emails_per_day AS
  SELECT (sent_at AT TIME ZONE 'Europe/London')::date                                   AS day,
         count(*) FILTER (WHERE outcome = 'sent' AND email_key = 'invitation')           AS invitations,
         count(*) FILTER (WHERE outcome = 'sent' AND scheduled AND email_key <> 'invitation') AS reminders,
         count(*) FILTER (WHERE outcome = 'sent' AND NOT scheduled)                      AS automatic,
         count(*) FILTER (WHERE outcome = 'failed')                                      AS failed,
         count(*) FILTER (WHERE outcome = 'sent')                                        AS total_sent
  FROM lr.email_sends
  GROUP BY 1;

-- The date n working days after p_day (Monday to Friday; bank holidays are
-- not known to the database).
CREATE FUNCTION lr.add_working_days(p_day date, p_n integer)
RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT d::date
  FROM generate_series(p_day + 1, p_day + p_n * 2 + 7, interval '1 day') AS d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5
  ORDER BY d
  OFFSET greatest(p_n, 1) - 1
  LIMIT 1;
$$;

-- "Scheduled for the next 5 working days". Only what the 9am job sends;
-- emails sent because something happens cannot be forecast.
-- p_from is passed in by the app (it may be a "run as if today is" date).
CREATE FUNCTION lr.email_forecast(p_from date, p_days integer DEFAULT 5)
RETURNS TABLE (
  day                date,
  invitations        integer,
  booking_reminders  integer,
  rebook_reminders   integer,
  session_reminders  integer,
  return_reminders   integer,
  total              integer
)
LANGUAGE sql STABLE AS $$
  WITH s AS (SELECT * FROM lr.settings WHERE id = 1),
  days AS (
    SELECT d::date AS day, (row_number() OVER (ORDER BY d))::integer AS n
    FROM generate_series(p_from, p_from + p_days * 2 + 7, interval '1 day') AS d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5
    ORDER BY d
    LIMIT p_days
  ),
  queued AS (SELECT count(*)::integer AS q FROM lr.cases WHERE status = 'queued'),
  f AS (
    SELECT d.day,
      greatest(0, least(s.invitations_per_working_day,
                        queued.q - (d.n - 1) * s.invitations_per_working_day)) AS invitations,
      CASE WHEN extract(isodow FROM d.day) = s.reminder_weekday THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status IN ('pending', 'unbooked') AND NOT c.reminders_paused
          AND c.invited_at IS NOT NULL
          AND (c.invited_at AT TIME ZONE 'Europe/London')::date + s.first_reminder_after_days <= d.day
      ) ELSE 0 END::integer AS booking_reminders,
      CASE WHEN extract(isodow FROM d.day) = s.reminder_weekday THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status = 'rebook_required'
          AND (c.rebook_requested_at AT TIME ZONE 'Europe/London')::date + 7 <= d.day
      ) ELSE 0 END::integer AS rebook_reminders,
      (SELECT count(*) FROM lr.bookings b
         LEFT JOIN lr.sessions se ON se.id = b.session_id
       WHERE b.status = 'booked'
         AND (se.id IS NULL OR se.status <> 'cancelled')
         AND (coalesce(se.starts_at, b.custom_starts_at) AT TIME ZONE 'Europe/London')::date
             = lr.add_working_days(d.day, s.software_lock_working_days)
      )::integer AS session_reminders,
      CASE WHEN s.return_reminders_enabled
            AND extract(isodow FROM d.day) = s.return_reminder_weekday THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status = 'awaiting_return' AND c.return_reminders
      ) ELSE 0 END::integer AS return_reminders
    FROM days d CROSS JOIN s CROSS JOIN queued
  )
  SELECT day, invitations, booking_reminders, rebook_reminders, session_reminders, return_reminders,
         invitations + booking_reminders + rebook_reminders + session_reminders + return_reminders
  FROM f
  ORDER BY day;
$$;

-- Deletes rows older than 13 months and returns how many went.
CREATE FUNCTION lr.purge_email_sends()
RETURNS integer
LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM lr.email_sends
    WHERE sent_at < now() - interval '13 months'
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;
```

## scripts/migrate.mjs

```js
// Runs db/migrations/*.sql in name order, each in its own transaction,
// and records what has run in public.schema_migrations.
//
//   MIGRATE_DATABASE_URL="postgres://portal_migrator:...@<server>.postgres.database.azure.com:5432/devices?sslmode=require" \
//     node db/scripts/migrate.mjs
//
// Always use port 5432 (direct), never 6432 (PgBouncer): migrations need a
// real session for DDL and the advisory lock below.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('Set MIGRATE_DATABASE_URL');
if (/:6432\//.test(url)) throw new Error('Use port 5432 for migrations, not the PgBouncer port 6432');

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  // Stops two deploys migrating at the same time.
  await client.query('SELECT pg_advisory_lock(727001)');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);

  const done = new Map(
    (await client.query('SELECT name, checksum FROM public.schema_migrations')).rows
      .map((r) => [r.name, r.checksum]),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (done.has(file)) {
      if (done.get(file) !== checksum) {
        throw new Error(`${file} has changed since it was applied. Add a new migration instead of editing an old one.`);
      }
      continue;
    }
    process.stdout.write(`Applying ${file} … `);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      console.log('done');
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('failed');
      throw err;
    }
  }
  console.log('Up to date.');
} finally {
  await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
  await client.end();
}
```
