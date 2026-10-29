-- =====================================================================
-- 0010_portal_users_on_demand.sql — users are created when needed
--
-- The Users page lists everyone in the staff directory, read live from
-- Entra ID (Microsoft Graph). Nobody is imported up front. A row in
-- portal.users is created only when something happens for that person:
--   sign_in       they sign in to the portal for the first time
--   case          they are added to a case (import, Add a case, receiver)
--   role_granted  someone saves a role for them on the Users page
--
-- Create the row with INSERT ... ON CONFLICT (entra_object_id) DO UPDATE,
-- so whichever of these happens first wins and the others just update it.
--
-- Role changes are recorded in portal.user_role_history for the
-- "Role history" list on each user.
-- =====================================================================

ALTER TABLE portal.users
  ADD COLUMN created_via        text NOT NULL DEFAULT 'sign_in'
    CHECK (created_via IN ('sign_in', 'case', 'role_granted')),
  ADD COLUMN created_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL when created by their own sign-in or by the system
  ADD COLUMN last_signed_in_at  timestamptz;

COMMENT ON COLUMN portal.users.created_via IS
  'What first created this user: their own sign-in, being added to a case, or being given a role.';

CREATE TABLE portal.user_role_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES portal.users (id) ON DELETE CASCADE,
  role        text NOT NULL,
  change      text NOT NULL CHECK (change IN ('added', 'removed')),
  changed_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_role_history_user_idx ON portal.user_role_history (user_id, changed_at DESC);

-- Keep the history automatically, whichever code path changes a role.
-- The app sets portal.acting_user for the transaction with
--   SELECT set_config('portal.acting_user', $1, true)
-- which is transaction-scoped, so it is safe through PgBouncer.
CREATE FUNCTION portal.user_roles_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := nullif(current_setting('portal.acting_user', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO portal.user_role_history (user_id, role, change, changed_by)
    VALUES (NEW.user_id, NEW.role, 'added', coalesce(actor, NEW.granted_by));
    RETURN NEW;
  ELSE
    INSERT INTO portal.user_role_history (user_id, role, change, changed_by)
    VALUES (OLD.user_id, OLD.role, 'removed', actor);
    RETURN OLD;
  END IF;
END $$;

CREATE TRIGGER user_roles_history AFTER INSERT OR DELETE ON portal.user_roles
  FOR EACH ROW EXECUTE FUNCTION portal.user_roles_history();
