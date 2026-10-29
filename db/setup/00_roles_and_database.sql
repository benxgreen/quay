-- =====================================================================
-- 00_roles_and_database.sql
-- Run ONCE per environment, as the Azure admin user, connected to the
-- built-in "postgres" database on port 5432 (NOT the PgBouncer port 6432).
--
--   psql "host=<server>.postgres.database.azure.com port=5432 dbname=postgres \
--         user=<azure-admin> sslmode=require" \
--        -v migrator_pw="'...'" -v app_pw="'...'" \
--        -f setup/00_roles_and_database.sql
--
-- Roles:
--   portal_migrator  owns every schema, table and sequence. Only migrations
--                    log in as this role.
--   portal_app       what Next.js logs in as (via PgBouncer). Can read and
--                    write rows, cannot create, alter or drop anything.
--   portal_readonly  optional, for reporting / Power BI.
-- =====================================================================

CREATE ROLE portal_migrator LOGIN PASSWORD :migrator_pw;
CREATE ROLE portal_app      LOGIN PASSWORD :app_pw;
CREATE ROLE portal_readonly NOLOGIN;

-- The Azure admin is not a superuser. Since PostgreSQL 16 a role you create
-- is not automatically one you can act as, so grant membership explicitly
-- before handing ownership of the database over.
GRANT portal_migrator TO CURRENT_USER;

CREATE DATABASE quay OWNER portal_migrator;

-- Nobody gets in unless granted.
REVOKE ALL ON DATABASE quay FROM PUBLIC;
GRANT CONNECT ON DATABASE quay TO portal_app, portal_readonly;

-- Server parameters to set in the Azure portal (Server parameters blade):
--   timezone             = Europe/London
--   pgbouncer.enabled    = true
--   pgbouncer.pool_mode  = transaction   (the default)
-- No extensions are needed: gen_random_uuid() is built in.
