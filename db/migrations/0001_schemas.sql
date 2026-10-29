-- =====================================================================
-- 0001_schemas.sql — run as portal_migrator, connected to "devices"
--
-- One database, one schema per service:
--   portal  shared: users, roles, things every service uses
--   lr      laptop replacements
--   sr      smartphone replacements (tables added in a later migration)
--   ns      new starters (later)
--
-- Every object created from here on is owned by portal_migrator, so the
-- default privileges below give portal_app and portal_readonly access to
-- them automatically. This is the step that is usually missed: without it,
-- each new table needs its own GRANT or the app gets "permission denied".
-- =====================================================================

CREATE SCHEMA portal;
CREATE SCHEMA lr;
CREATE SCHEMA sr;

-- Stop anyone creating objects in "public" by accident.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- USAGE lets a role see inside a schema. Without it every query fails with
-- "permission denied for schema lr" even when table grants are correct.
GRANT USAGE ON SCHEMA portal, lr, sr TO portal_app, portal_readonly;

-- Future tables, sequences and functions created by portal_migrator.
-- (Default privileges only apply to objects created AFTER this runs, by
--  the role named in FOR ROLE — which is why ownership must stay with one role.)
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT USAGE, SELECT ON SEQUENCES TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT EXECUTE ON FUNCTIONS TO portal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE portal_migrator IN SCHEMA portal, lr, sr
  GRANT SELECT ON TABLES TO portal_readonly;

-- Shared helper: keep updated_at current on every table that has one.
CREATE FUNCTION portal.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
