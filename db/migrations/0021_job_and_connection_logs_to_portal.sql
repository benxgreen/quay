-- =====================================================================
-- 0021_job_and_connection_logs_to_portal.sql
--
-- The scheduled job log and the connection log belong to the whole
-- portal, not one service, so they move from lr to portal with a service
-- column (decided 30 Oct 2026). Every service's jobs and external calls
-- are logged in the same place.
--
-- Rows keep their case and booking IDs, but no longer have foreign keys
-- into lr: a portal table can't depend on one service's schema. The ID
-- means "the record in that service's schema", named by `service`.
--
-- The views and the purge function move too. Grants and the email counts'
-- link to the connection log follow the tables.
-- =====================================================================

-- Connection log ------------------------------------------------------

ALTER TABLE lr.connection_log DROP CONSTRAINT connection_log_case_id_fkey;
ALTER TABLE lr.connection_log SET SCHEMA portal;

-- NULL for calls not made for one service, such as staff details at sign-in.
ALTER TABLE portal.connection_log ADD COLUMN service text;
UPDATE portal.connection_log SET service = 'laptop_replacements' WHERE case_id IS NOT NULL;
COMMENT ON COLUMN portal.connection_log.case_id IS
  'The case the call was for, in the schema of the service named in `service`.';

ALTER VIEW lr.connection_log_recent SET SCHEMA portal;
ALTER VIEW lr.connection_last_used SET SCHEMA portal;

DROP FUNCTION lr.purge_connection_log();

-- Deletes rows older than 7 days and returns how many went.
CREATE FUNCTION portal.purge_connection_log()
RETURNS integer
LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM portal.connection_log
    WHERE occurred_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

-- Job log -------------------------------------------------------------

ALTER TABLE lr.job_run_cases DROP CONSTRAINT job_run_cases_case_id_fkey;
ALTER TABLE lr.job_run_cases DROP CONSTRAINT job_run_cases_booking_id_fkey;
ALTER TABLE lr.job_runs SET SCHEMA portal;
ALTER TABLE lr.job_run_cases SET SCHEMA portal;

ALTER TABLE portal.job_runs ADD COLUMN service text;
UPDATE portal.job_runs SET service = 'laptop_replacements';
ALTER TABLE portal.job_runs ALTER COLUMN service SET NOT NULL;

COMMENT ON COLUMN portal.job_run_cases.case_id IS
  'The case the run touched, in the schema of its run''s service.';
COMMENT ON COLUMN portal.job_run_cases.booking_id IS
  'The booking, if the job was about one, in the same service''s schema.';

-- One run of each service's job at a time.
DROP INDEX portal.job_runs_one_running;
CREATE UNIQUE INDEX job_runs_one_running ON portal.job_runs (service, job) WHERE finished_at IS NULL;

DROP INDEX portal.job_runs_job_day_idx;
CREATE INDEX job_runs_job_day_idx ON portal.job_runs (service, job, run_date);
