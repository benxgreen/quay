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
