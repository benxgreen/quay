-- =====================================================================
-- 0006_lr_case_checks_box.sql — tie device preparation checks to the box
--
-- Device preparation checks belong to a specific device. When a device is
-- unallocated, its checks are cleared and the next box starts afresh.
-- Recording the box on each check keeps that history clear. Decommission
-- checks are about the OLD device, so they leave box_number empty.
-- =====================================================================

ALTER TABLE lr.case_checks ADD COLUMN box_number text;

ALTER TABLE lr.case_checks
  ADD CONSTRAINT case_checks_prep_has_box
  CHECK (step <> 'device_preparation' OR box_number IS NOT NULL);

-- The old "one row per position" rule would block a fresh set of checks
-- for a second box, so scope it to the box.
ALTER TABLE lr.case_checks DROP CONSTRAINT case_checks_case_id_step_sort_order_key;
CREATE UNIQUE INDEX case_checks_position_key
  ON lr.case_checks (case_id, step, coalesce(box_number, ''), sort_order);

-- copy_checklist now takes the box for step 2.
DROP FUNCTION lr.copy_checklist(bigint, text);
CREATE FUNCTION lr.copy_checklist(p_case_id bigint, p_step text, p_box_number text DEFAULT NULL)
RETURNS integer
LANGUAGE sql AS $$
  WITH ins AS (
    INSERT INTO lr.case_checks (case_id, step, box_number, checklist_item_id, label, sort_order)
    SELECT p_case_id, p_step, p_box_number, i.id, i.label,
           row_number() OVER (ORDER BY i.sort_order, i.id)
    FROM lr.checklist_items i
    WHERE i.list = p_step AND i.active
      AND NOT EXISTS (SELECT 1 FROM lr.case_checks c
                      WHERE c.case_id = p_case_id AND c.step = p_step
                        AND c.box_number IS NOT DISTINCT FROM p_box_number)
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins;
$$;
