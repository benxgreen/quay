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
