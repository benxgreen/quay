-- =====================================================================
-- 0024_username_from_entra.sql
--
-- Halo doesn't hold the full username with its domain prefix (such as
-- bcp\ben.green), so it will come from Entra ID instead (decided 31 Oct
-- 2026). The username mapping and prefix leave the Halo settings.
-- =====================================================================

ALTER TABLE portal.halo_settings
  DROP COLUMN username_field,
  DROP COLUMN username_prefix;
