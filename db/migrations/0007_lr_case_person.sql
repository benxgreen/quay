-- =====================================================================
-- 0007_lr_case_person.sql — the case is in the name of the person it's for
--
-- lr.cases.user_id is the person the case is for: the case name shown
-- everywhere, and who gets invitations and booking emails. This is the
-- person the device is listed against in the portal, which isn't
-- necessarily the Halo device allocation.
-- lr.cases.halo_assigned_user_id is the device's assigned user in Halo,
-- kept for reference. It's usually the same person, and is different when
-- someone else is receiving the laptop.
-- =====================================================================

ALTER TABLE lr.cases DROP CONSTRAINT cases_recipient_differs;
ALTER TABLE lr.cases RENAME COLUMN recipient_user_id TO halo_assigned_user_id;
ALTER INDEX lr.cases_recipient_idx RENAME TO cases_halo_assigned_idx;

COMMENT ON COLUMN lr.cases.user_id IS
  'Person the case is for: the case name and who receives emails. Not necessarily the Halo assigned user.';
COMMENT ON COLUMN lr.cases.halo_assigned_user_id IS
  'Assigned user of the old device in Halo, for reference.';
