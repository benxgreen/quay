-- =====================================================================
-- 0004_lr_seed.sql — starting configuration (all editable in Settings)
-- =====================================================================

INSERT INTO lr.session_defaults (session_type, start_time, capacity, location) VALUES
  ('collection', '10:00', 10, 'Room 310, BCP Council Civic Centre, Bournemouth'),
  ('session',    '10:00',  5, 'Room 310, BCP Council Civic Centre, Bournemouth');

INSERT INTO lr.software (name, hint, sort_order) VALUES
  ('Adobe Acrobat Pro', 'Used for editing and signing PDFs. This software requires a licence.', 1),
  ('ArcGIS Pro',        'Used by people working in GIS. This software requires a licence.', 2),
  ('AutoCAD LT',        'Used for technical and architectural drawings. This software requires a licence.', 3),
  ('Microsoft Project', 'Used for planning and tracking projects. This software requires a licence.', 4),
  ('Microsoft Visio',   'Used for diagrams, flowcharts and floor plans. This software requires a licence.', 5),
  ('SPSS Statistics',   'Used for statistical analysis. This software requires a licence.', 6);

INSERT INTO lr.checklist_items (list, label, sort_order) VALUES
  ('device_preparation', 'Primary user changed to the colleague in Intune', 1),
  ('device_preparation', 'Windows and driver updates installed', 2),
  ('device_preparation', 'Device shows as compliant in Intune', 3),
  ('device_preparation', 'BitLocker enabled and recovery key escrowed', 4),
  ('decommission',       'Removed from Intune', 1),
  ('decommission',       'Removed from Entra ID', 2),
  ('decommission',       'BitLocker recovery key archived', 3),
  ('decommission',       'Drive securely wiped', 4),
  ('decommission',       'Asset label removed', 5),
  ('decommission',       'Placed in the disposal store', 6);

INSERT INTO lr.page_content (session_type, body_markdown) VALUES
  ('session', E'## Before your session\n\nWe will email you a reminder 3 working days before your session. Before then:\n\n- move anything you need to keep from your Downloads folder into your Documents folder, which is synced with OneDrive – files left in Downloads will not be moved to your new laptop\n- make a note of your username, **{username}** – you will need it to sign in to your new laptop\n\n## On the day\n\nYou will need to bring:\n\n- your current laptop\n- its charger\n- your laptop bag, if you have one'),
  ('collection', '');

INSERT INTO lr.faqs (question, answer_markdown, shown_for, sort_order) VALUES
  ('How long does it take?', 'Your session takes about 1 hour. You can go back to work with your new laptop straight after.', '{session}', 1),
  ('How long does it take?', 'Collecting your laptop takes about 10 minutes.', '{collection}', 2),
  ('Will my files move to my new laptop?', 'Files saved in OneDrive, including your Documents folder, will be there when you sign in. Files in your Downloads folder will not be moved.', '{session,collection}', 3),
  ('Can I keep using my old laptop until my session?', 'Yes. Keep using it as normal and bring it with you on the day.', '{session}', 4),
  ('What happens to my old laptop?', 'We securely wipe it and then recycle it.', '{session,collection}', 5),
  ('What if I cannot make my session?', 'Rebook onto another date using the Rebook link above. You cannot cancel your booking.', '{session,collection}', 6);
