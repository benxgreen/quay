-- =====================================================================
-- 0026_audit_notes_shared_variables.sql
--
-- Laptop replacements has one list of variables for emails, page content
-- and audit notes (31 Oct 2026), so the audit notes use the same names as
-- the emails: {person} becomes {full_name} and {reference} becomes
-- {case_reference}.
-- =====================================================================

UPDATE lr.halo_settings
SET collected_note = replace(replace(collected_note, '{person}', '{full_name}'), '{reference}', '{case_reference}'),
    returned_note  = replace(replace(returned_note,  '{person}', '{full_name}'), '{reference}', '{case_reference}'),
    updated_at = now()
WHERE id = 1;

ALTER TABLE lr.halo_settings ALTER COLUMN collected_note SET DEFAULT 'Device collected by {full_name} - {case_reference}';
ALTER TABLE lr.halo_settings ALTER COLUMN returned_note SET DEFAULT 'Device returned by {full_name} - {case_reference}';
