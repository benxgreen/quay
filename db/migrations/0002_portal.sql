-- =====================================================================
-- 0002_portal.sql — shared tables every service points at
-- =====================================================================

-- People, kept in step with Entra ID / the staff directory on sign-in.
CREATE TABLE portal.users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_object_id  uuid UNIQUE,                  -- oid claim from Entra ID
  email            text NOT NULL,
  display_name     text NOT NULL,
  username         text,                         -- e.g. bcp-cs\john.smith
  job_title        text,
  department       text,
  manager_id       uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive unique email without needing the citext extension.
CREATE UNIQUE INDEX users_email_key ON portal.users (lower(email));
CREATE INDEX users_manager_idx ON portal.users (manager_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON portal.users
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();

-- Portal roles. Text plus a CHECK rather than an enum type, so adding a
-- role later is a one-line constraint change instead of ALTER TYPE.
CREATE TABLE portal.user_roles (
  user_id     uuid NOT NULL REFERENCES portal.users (id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN (
                'administrator',        -- portal-wide, e.g. Connections
                'replacements_team',
                'replacements_admin',
                'new_starters_team'
              )),
  granted_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
