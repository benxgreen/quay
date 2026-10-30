-- =====================================================================
-- 0017_halo_stock_snapshot.sql — the latest Halo stock list
--
-- Like the Import report (0016): the Stock page shows "Updated from Halo
-- at 10:42am today", and only "Refresh from Halo" (or the first visit)
-- calls Halo. The case page's device dropdown reads the same list. A box
-- seen for the first time gets "First seen in Halo stock" in its device
-- journal.
-- =====================================================================

CREATE TABLE lr.halo_stock (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  fetched_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  devices     jsonb NOT NULL CHECK (jsonb_typeof(devices) = 'array')
);

COMMENT ON TABLE lr.halo_stock IS
  'The latest Halo stock list for the Stock page and the case device dropdown, replaced by "Refresh from Halo".';
