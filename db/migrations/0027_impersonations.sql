-- =====================================================================
-- 0027_impersonations.sql
--
-- Administrators can see the portal as another user (31 Oct 2026). Each
-- impersonation is recorded here when it starts and closed when it stops,
-- so there is an audit trail of who saw the portal as whom. Rows are never
-- edited apart from ended_at, and never deleted.
-- =====================================================================

CREATE TABLE portal.impersonations (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id  uuid NOT NULL REFERENCES portal.users (id),
  user_id        uuid NOT NULL REFERENCES portal.users (id),
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  CONSTRAINT impersonations_not_self CHECK (admin_user_id <> user_id)
);

CREATE INDEX impersonations_admin_idx ON portal.impersonations (admin_user_id, started_at DESC);
CREATE INDEX impersonations_user_idx ON portal.impersonations (user_id, started_at DESC);

-- Only ended_at changes after a row is written.
REVOKE UPDATE, DELETE ON portal.impersonations FROM portal_app;
GRANT UPDATE (ended_at) ON portal.impersonations TO portal_app;
