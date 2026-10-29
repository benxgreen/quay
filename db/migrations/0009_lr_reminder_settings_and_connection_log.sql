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
