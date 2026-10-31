-- =====================================================================
-- 0023_halo_staff_fields_from_report.sql
--
-- Halo keeps job title, department and the manager's email in generic
-- user fields. The end-of-life report (566) reads them as
--   u.uother2 AS [Job Title], u.uother5 AS [Department],
--   LOWER(u.uadmanager) AS [Manager Email Address]
-- which the API returns as other2, other5 and admanager. Use the same
-- fields, so the portal and the report agree (31 Oct 2026). They can be
-- changed in Portal settings › Halo › Field mapping.
-- =====================================================================

UPDATE portal.halo_settings
SET job_title_field = 'other2',
    department_field = 'other5',
    manager_email_field = 'admanager',
    updated_at = now()
WHERE id = 1;
