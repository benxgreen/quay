-- =====================================================================
-- 0015_halo_connection_staff_and_failed_journal.sql
--
-- 1. One Halo connection. Every Halo call (the end-of-life report, stock,
--    staff details, the completion update that puts a device In Service,
--    old device returned and the decommission hook) uses the Halo API base
--    URL. Each part of the portal declares the Halo calls it needs on top
--    of it. Replaces halo_import, halo_stock and decommission_hook.
--
-- 2. Staff details come from Halo, not Microsoft Graph. Entra ID is only
--    for sign-in: its object ID (portal.users.entra_object_id) pairs with
--    the Halo user, which holds name, email, username, job title and
--    department.
--
-- 3. Every action writes a journal entry, including one whose external
--    call failed. A failed entry is marked so the journal can show a
--    Failed tag; nothing else about the case changes.
-- =====================================================================

-- 1. One Halo connection --------------------------------------------------

DELETE FROM portal.connections WHERE key IN ('halo_import', 'halo_stock', 'decommission_hook');

INSERT INTO portal.connections (key, label) VALUES
  ('halo', 'Halo API base URL');

COMMENT ON COLUMN lr.connection_log.connection IS
  'The connection the client called: halo or email_webhook. The summary says which call it was.';


-- 2. Staff details from Halo ---------------------------------------------

ALTER TABLE portal.users
  ADD COLUMN halo_user_id integer UNIQUE;

COMMENT ON COLUMN portal.users.halo_user_id IS
  'The Halo user matched by entra_object_id. Name, email, username, job title and department are copied from Halo.';

COMMENT ON TABLE portal.users IS
  'Created on demand (sign-in, a case, a role). Staff details come from the Halo user; Entra ID is only for sign-in.';


-- 3. Failed actions in the journal ---------------------------------------

ALTER TABLE lr.journal_entries
  ADD COLUMN outcome text NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'failed'));

COMMENT ON COLUMN lr.journal_entries.outcome IS
  'failed when the action''s external call failed and nothing changed; shown with a Failed tag.';
