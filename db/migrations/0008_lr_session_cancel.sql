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
