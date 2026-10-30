-- =====================================================================
-- 0016_halo_report_snapshot.sql — the latest Halo end-of-life report
--
-- The Import page shows "Updated from Halo at 9:14am today" and only calls
-- Halo when someone selects "Refresh from Halo" (or there is no report
-- yet). This keeps the last report, with each device's assigned user as
-- checked in Halo's staff directory at the time, so viewing, filtering and
-- paging the page make no Halo calls. Only the latest report is kept.
-- =====================================================================

CREATE TABLE lr.halo_report (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  fetched_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  -- One element per laptop: the Halo report fields, the assigned user as
  -- found in Halo (or null) and the result of that check.
  devices     jsonb NOT NULL CHECK (jsonb_typeof(devices) = 'array')
);

COMMENT ON TABLE lr.halo_report IS
  'The latest Halo end-of-life report for the Import page, replaced by "Refresh from Halo".';
