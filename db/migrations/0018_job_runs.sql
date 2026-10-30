-- =====================================================================
-- 0018_job_runs.sql
--
-- The job log (spec, "Scheduled jobs and events"): one row for every run
-- of a scheduled job (started, finished, records processed, errors), and
-- one row for every case a run touched, so the team can trace which job
-- did what. Shown on Settings › Scheduled jobs.
--
-- lr.job_run_cases is also what keeps the jobs idempotent: a job skips a
-- case it has already emailed for the same day (run_date), so a re-run
-- never sends a duplicate. run_date is the day the job ran for, which in
-- development can be a "run as if today is" date.
-- =====================================================================

CREATE TABLE lr.job_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job           text        NOT NULL,
  run_date      date        NOT NULL,
  as_if         boolean     NOT NULL DEFAULT false,  -- run "as if today is" run_date, in development
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  processed     integer     NOT NULL DEFAULT 0,
  failed        integer     NOT NULL DEFAULT 0,
  note          text,                                -- for example "Not a working day"
  error         text,                                -- why the run stopped, if it did
  triggered_by  uuid REFERENCES portal.users (id)    -- NULL when the timer ran it
);

CREATE INDEX job_runs_started_idx ON lr.job_runs (started_at DESC);
CREATE INDEX job_runs_job_day_idx ON lr.job_runs (job, run_date);

-- Only one run of a job at a time, so two timers can't send the same email
-- twice. The app closes a run left unfinished for over an hour first.
CREATE UNIQUE INDEX job_runs_one_running ON lr.job_runs (job) WHERE finished_at IS NULL;

CREATE TABLE lr.job_run_cases (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_run_id  bigint NOT NULL REFERENCES lr.job_runs (id),
  case_id     bigint NOT NULL REFERENCES lr.cases (id),
  booking_id  bigint REFERENCES lr.bookings (id),
  outcome     text   NOT NULL CHECK (outcome IN ('sent', 'failed')),
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_run_cases_run_idx  ON lr.job_run_cases (job_run_id);
CREATE INDEX job_run_cases_case_idx ON lr.job_run_cases (case_id);
