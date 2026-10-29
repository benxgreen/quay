-- =====================================================================
-- 0013_steps_connections_and_fixes.sql
--
-- Decisions made after the schema handoff (29 Oct 2026):
--
-- 1. Step completion. "Confirm device prepared" and "Confirm software
--    prepared" are recorded on the case. The ticks alone cannot tell a
--    reopened step (ticks kept) from a finished one. Unallocating a device
--    clears device_prepared_*; Reopen clears the step's *_at and *_by and
--    keeps the ticks.
--
-- 2. lr.imports.file_name is nullable: imports come from the Halo report API,
--    not a file upload.
--
-- 3. lr.connection_log.connection has no CHECK. Each client names its own
--    connection, so a new client needs no migration.
--
-- 4. lr.software.sort_order is dropped: the software list is always shown
--    sorted by name.
--
-- 5. portal.connections holds the URL for each external connection (API
--    base URLs, webhook links), editable by Administrators in Settings.
--    Secrets (client secrets, keys) are NOT stored here: they are in the
--    app's environment. Halo and Power Automate are shared by every
--    service, so the table is in portal, not lr.
--
-- 6. lr.add_working_days(d, 0) returns d (it returned the next weekday),
--    and a three-argument version skips the bank holidays it is given.
--
-- 7. lr.email_forecast takes the bank holidays too, so its "next working
--    days" and session reminder dates skip them. The app passes the dates
--    from the GOV.UK bank holidays feed; the database cannot fetch them.
--
-- 8. Journals are append-only for the app: portal_app can no longer UPDATE
--    or DELETE journal entries, device journal entries or role history, or
--    DELETE cases. (Role history is included because it is also a record
--    that is never edited.)
-- =====================================================================


-- 1. Step completion ----------------------------------------------------

ALTER TABLE lr.cases
  ADD COLUMN device_prepared_at   timestamptz,
  ADD COLUMN device_prepared_by   uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  ADD COLUMN software_prepared_at timestamptz,
  ADD COLUMN software_prepared_by uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT cases_device_prepared_complete
    CHECK (device_prepared_by IS NULL OR device_prepared_at IS NOT NULL),
  ADD CONSTRAINT cases_software_prepared_complete
    CHECK (software_prepared_by IS NULL OR software_prepared_at IS NOT NULL);

COMMENT ON COLUMN lr.cases.device_prepared_at IS
  'Step 2 confirmed. Cleared when the device is unallocated or step 2 is reopened.';
COMMENT ON COLUMN lr.cases.software_prepared_at IS
  'Step 3 confirmed. Cleared when step 3 is reopened.';


-- 2. Imports from the Halo API ------------------------------------------

ALTER TABLE lr.imports ALTER COLUMN file_name DROP NOT NULL;

COMMENT ON COLUMN lr.imports.file_name IS
  'Not used for imports from the Halo report API; kept for any file import.';


-- 3. Connection names are set by each client ----------------------------

ALTER TABLE lr.connection_log DROP CONSTRAINT connection_log_connection_check;

COMMENT ON COLUMN lr.connection_log.connection IS
  'The name the client declares, such as halo_import or email_webhook.';


-- 4. Software list is sorted by name -----------------------------------

ALTER TABLE lr.software DROP COLUMN sort_order;


-- 5. Connection URLs ----------------------------------------------------

CREATE TABLE portal.connections (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),  -- matches lr.connection_log.connection
  label       text NOT NULL,                                       -- shown in Settings › Connections
  url         text CHECK (url IS NULL OR url ~ '^https?://'),      -- NULL until an Administrator sets it
  updated_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER connections_updated_at BEFORE UPDATE ON portal.connections
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();

COMMENT ON TABLE portal.connections IS
  'URLs for external connections, editable by Administrators. Secrets are in the app environment, never here.';

INSERT INTO portal.connections (key, label) VALUES
  ('halo_import',       'Halo import report API link'),
  ('halo_stock',        'Halo stock API link'),
  ('decommission_hook', 'Decommission hook link'),
  ('email_webhook',     'Power Automate webhook link');


-- 6. Working days ------------------------------------------------------

-- The date p_n working days after p_day, skipping weekends and the given
-- bank holidays. p_n = 0 returns p_day.
CREATE FUNCTION lr.add_working_days(p_day date, p_n integer, p_bank_holidays date[])
RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_n <= 0 THEN p_day ELSE (
    SELECT d::date
    FROM generate_series(p_day + 1,
                         p_day + p_n * 2 + 14 + coalesce(cardinality(p_bank_holidays), 0),
                         interval '1 day') AS d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5
      AND NOT (d::date = ANY (coalesce(p_bank_holidays, '{}')))
    ORDER BY d
    OFFSET p_n - 1
    LIMIT 1
  ) END;
$$;

-- The two-argument form keeps working (weekdays only) and now returns
-- p_day for p_n = 0.
CREATE OR REPLACE FUNCTION lr.add_working_days(p_day date, p_n integer)
RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT lr.add_working_days(p_day, p_n, '{}'::date[]);
$$;


-- 7. Email forecast with bank holidays --------------------------------

-- Same as 0012 apart from the bank holidays: the days listed are the next
-- p_days working days, and session reminders use bank-holiday-aware dates.
-- Weekly reminders still go on reminder_weekday; whether they move when
-- that day is a bank holiday is an open question, so on such a day they
-- are simply not listed.
DROP FUNCTION lr.email_forecast(date, integer);

CREATE FUNCTION lr.email_forecast(
  p_from          date,
  p_days          integer DEFAULT 5,
  p_bank_holidays date[]  DEFAULT '{}'
)
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
    FROM generate_series(p_from,
                         p_from + p_days * 2 + 14 + coalesce(cardinality(p_bank_holidays), 0),
                         interval '1 day') AS d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5
      AND NOT (d::date = ANY (coalesce(p_bank_holidays, '{}')))
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
             = lr.add_working_days(d.day, s.software_lock_working_days, p_bank_holidays)
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


-- 8. Append-only records ----------------------------------------------

REVOKE UPDATE, DELETE ON lr.journal_entries     FROM portal_app;
REVOKE UPDATE, DELETE ON lr.device_journal      FROM portal_app;
REVOKE UPDATE, DELETE ON portal.user_role_history FROM portal_app;
REVOKE DELETE         ON lr.cases               FROM portal_app;
