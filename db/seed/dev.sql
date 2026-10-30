-- =====================================================================
-- dev.sql: development data. NEVER run against a shared environment.
--
-- Run with `npm run db:seed` (db/scripts/seed-dev.mjs) after migrating an
-- empty database. It runs as portal_migrator on the direct port, so it can
-- use session-only helpers in pg_temp; the app never does this.
--
-- Dates are relative to today, so the data stays current whenever the
-- database is rebuilt. People and devices are made up; names follow the
-- mockups. Email addresses use the reserved .test domain so nothing can
-- reach a real inbox.
-- =====================================================================

-- Helpers for this session only ------------------------------------------

CREATE FUNCTION pg_temp.u(p_email text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT id FROM portal.users WHERE email = p_email $$;

CREATE FUNCTION pg_temp.c(p_asset text) RETURNS bigint
LANGUAGE sql STABLE AS $$ SELECT id FROM lr.cases WHERE old_asset_id = p_asset $$;

-- A London local time on a date, as timestamptz.
CREATE FUNCTION pg_temp.at(p_day date, p_time time) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT (p_day + p_time) AT TIME ZONE 'Europe/London' $$;

-- n working days from today (weekdays only; good enough for development).
CREATE FUNCTION pg_temp.wd(p_n integer) RETURNS date
LANGUAGE sql STABLE AS $$ SELECT lr.add_working_days(current_date, p_n) $$;

-- The Tuesday two weeks ago, for sessions that have already happened.
CREATE FUNCTION pg_temp.past_tuesday() RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT (current_date - 14) - extract(isodow FROM current_date - 14)::integer + 2
$$;

CREATE TEMP TABLE seed_sessions (label text PRIMARY KEY, id bigint NOT NULL);


-- People ----------------------------------------------------------------

-- John Smith has the same id as MOCK_TEAM_USER in mocks/users.ts.
INSERT INTO portal.users (id, entra_object_id, email, display_name, username, job_title, department, created_via) VALUES
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'john.smith@bcpcouncil.test',     'John Smith',     'john.smith',     'Desktop Infrastructure Engineer', 'IT & Programmes', 'sign_in'),
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'alex.morgan@bcpcouncil.test',    'Alex Morgan',    'alex.morgan',    'Desktop Infrastructure Engineer', 'IT & Programmes', 'role_granted'),
  -- Same id as MOCK_COLLEAGUE in mocks/users.ts
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'priya.hart@bcpcouncil.test',     'Priya Hart',     'priya.hart',     'Planning Officer',                'Planning',        'sign_in');

INSERT INTO portal.users (email, display_name, username, job_title, department, created_via, created_by) VALUES
  ('amira.shah@bcpcouncil.test',     'Amira Shah',     'amira.shah',     'GIS Analyst',               'Planning',            'case', '00000000-0000-4000-8000-000000000001'),
  ('owen.price@bcpcouncil.test',     'Owen Price',     'owen.price',     'Housing Officer',           'Housing',             'case', '00000000-0000-4000-8000-000000000001'),
  ('marcus.hale@bcpcouncil.test',    'Marcus Hale',    'marcus.hale',    'Data Analyst',              'Finance',             'case', '00000000-0000-4000-8000-000000000001'),
  ('ravi.menon@bcpcouncil.test',     'Ravi Menon',     'ravi.menon',     'Building Control Surveyor', 'Planning',            'case', '00000000-0000-4000-8000-000000000001'),
  ('dan.hughes@bcpcouncil.test',     'Dan Hughes',     'dan.hughes',     'Night Warden',              'Housing',             'case', '00000000-0000-4000-8000-000000000001'),
  ('chloe.barnes@bcpcouncil.test',   'Chloe Barnes',   'chloe.barnes',   'Customer Adviser',          'Customer Services',   'case', '00000000-0000-4000-8000-000000000001'),
  ('ellie.ward@bcpcouncil.test',     'Ellie Ward',     'ellie.ward',     'Licensing Officer',         'Licensing',           'case', '00000000-0000-4000-8000-000000000001'),
  ('nadia.kowalski@bcpcouncil.test', 'Nadia Kowalski', 'nadia.kowalski', 'Social Worker',             'Children’s Services', 'case', '00000000-0000-4000-8000-000000000001'),
  ('kate.morris@bcpcouncil.test',    'Kate Morris',    'kate.morris',    'Accountant',                'Finance',             'case', '00000000-0000-4000-8000-000000000001'),
  ('tom.fielding@bcpcouncil.test',   'Tom Fielding',   'tom.fielding',   'Parks Officer',             'Environment',         'case', '00000000-0000-4000-8000-000000000001'),
  ('leah.turner@bcpcouncil.test',    'Leah Turner',    'leah.turner',    'Events Coordinator',        'Communities',         'case', '00000000-0000-4000-8000-000000000001'),
  ('ben.whitaker@bcpcouncil.test',   'Ben Whitaker',   'ben.whitaker',   'Project Manager',           'IT & Programmes',     'case', '00000000-0000-4000-8000-000000000001'),
  ('ruth.collins@bcpcouncil.test',   'Ruth Collins',   'ruth.collins',   'Benefits Assessor',         'Revenues & Benefits', 'case', '00000000-0000-4000-8000-000000000001'),
  ('aisha.begum@bcpcouncil.test',    'Aisha Begum',    'aisha.begum',    'Library Assistant',         'Communities',         'case', '00000000-0000-4000-8000-000000000001'),
  ('adam.kerr@bcpcouncil.test',      'Adam Kerr',      'adam.kerr',      'Team Leader',               'Waste Services',      'case', '00000000-0000-4000-8000-000000000001'),
  ('sam.taylor@bcpcouncil.test',     'Sam Taylor',     'sam.taylor',     'Waste Services Officer',    'Waste Services',      'case', '00000000-0000-4000-8000-000000000001');

-- Everyone is matched to their Halo user (mocks/halo.ts MOCK_HALO_USERS),
-- which is where staff details come from.
UPDATE portal.users u
SET halo_user_id = 1000 + h.n,
    entra_object_id = ('10000000-0000-4000-8000-' || lpad(h.n::text, 12, '0'))::uuid
FROM (VALUES
  ('john.smith', 1), ('priya.hart', 2), ('alex.morgan', 3), ('amira.shah', 4), ('owen.price', 5),
  ('marcus.hale', 6), ('ravi.menon', 7), ('dan.hughes', 8), ('chloe.barnes', 9), ('ellie.ward', 10),
  ('nadia.kowalski', 11), ('kate.morris', 12), ('tom.fielding', 13), ('leah.turner', 14),
  ('ben.whitaker', 15), ('ruth.collins', 16), ('aisha.begum', 17), ('adam.kerr', 18), ('sam.taylor', 19)
) AS h(username, n)
WHERE u.email = h.username || '@bcpcouncil.test';

UPDATE portal.users SET last_signed_in_at = now() - interval '2 hours'
WHERE email IN ('john.smith@bcpcouncil.test', 'priya.hart@bcpcouncil.test');

INSERT INTO portal.user_roles (user_id, role, granted_by) VALUES
  (pg_temp.u('john.smith@bcpcouncil.test'),  'administrator', pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('john.smith@bcpcouncil.test'),  'laptops_team',  pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('john.smith@bcpcouncil.test'),  'laptops_admin', pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('alex.morgan@bcpcouncil.test'), 'laptops_team',  pg_temp.u('john.smith@bcpcouncil.test'));


-- Sessions -------------------------------------------------------------

WITH s AS (
  INSERT INTO lr.sessions (session_type, starts_at, capacity, location, created_by)
  VALUES
    ('session',    pg_temp.at(pg_temp.wd(2),  '09:30'), 5,  'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test')),
    ('collection', pg_temp.at(pg_temp.wd(2),  '10:00'), 10, 'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test')),
    ('session',    pg_temp.at(pg_temp.wd(8),  '09:30'), 5,  'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test')),
    ('collection', pg_temp.at(pg_temp.wd(8),  '14:00'), 10, 'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test')),
    ('session',    pg_temp.at(pg_temp.wd(12), '09:30'), 5,  'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test')),
    ('collection', pg_temp.at(pg_temp.past_tuesday(), '10:00'), 10, 'Room 310, BCP Council Civic Centre, Bournemouth', pg_temp.u('john.smith@bcpcouncil.test'))
  RETURNING id, session_type, starts_at
)
INSERT INTO seed_sessions (label, id)
SELECT CASE
         WHEN starts_at < now() THEN 'past_collection'
         WHEN starts_at::date = pg_temp.wd(2)  AND session_type = 'session'    THEN 'soon_session'
         WHEN starts_at::date = pg_temp.wd(2)                                  THEN 'soon_collection'
         WHEN starts_at::date = pg_temp.wd(8)  AND session_type = 'session'    THEN 'next_session'
         WHEN starts_at::date = pg_temp.wd(8)                                  THEN 'next_collection'
         ELSE 'later_session'
       END, id
FROM s;

UPDATE lr.sessions SET status = 'closed' WHERE id = (SELECT id FROM seed_sessions WHERE label = 'past_collection');

-- A session the team cancelled.
WITH s AS (
  INSERT INTO lr.sessions (session_type, starts_at, capacity, location, status, created_by,
                           cancelled_at, cancelled_by, cancelled_reason)
  VALUES ('collection', pg_temp.at(pg_temp.wd(5), '10:00'), 10,
          'Room 310, BCP Council Civic Centre, Bournemouth', 'cancelled',
          pg_temp.u('john.smith@bcpcouncil.test'),
          now() - interval '1 day', pg_temp.u('john.smith@bcpcouncil.test'),
          'Room 310 needed for an emergency planning exercise')
  RETURNING id
)
INSERT INTO seed_sessions (label, id) SELECT 'cancelled_collection', id FROM s;


-- Previous replacements (the old workbook) and an import ----------------

INSERT INTO lr.previous_replacements (old_asset_id, old_serial, completed_on) VALUES
  ('29001', '051234998761', current_date - 400),
  ('29002', '051234998762', current_date - 380),
  ('29003', '051234998763', current_date - 365);

INSERT INTO lr.imports (imported_by, imported_at, rows_total, rows_queued)
VALUES (pg_temp.u('john.smith@bcpcouncil.test'), now() - interval '3 days', 64, 3);


-- Cases ----------------------------------------------------------------
-- One or more at every status. Asset IDs are unique per case and used to
-- find each case below.

INSERT INTO lr.cases (user_id, halo_assigned_user_id, session_type, status, old_asset_id, old_serial, old_hostname,
                      import_id, queued_at, invited_at, reminders_sent, last_reminder_at, created_by)
VALUES
  -- Queued
  (pg_temp.u('ben.whitaker@bcpcouncil.test'),  pg_temp.u('ben.whitaker@bcpcouncil.test'),  'session',    'queued', '31940', '061977228654', 'IT-tr7crGNtSesx', (SELECT max(id) FROM lr.imports), now() - interval '3 days', NULL, 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('ruth.collins@bcpcouncil.test'),  pg_temp.u('ruth.collins@bcpcouncil.test'),  'collection', 'queued', '31941', '061977228655', 'IT-Hq3PzR8vLm2K', (SELECT max(id) FROM lr.imports), now() - interval '3 days' + interval '1 minute', NULL, 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('aisha.begum@bcpcouncil.test'),   pg_temp.u('aisha.begum@bcpcouncil.test'),   'session',    'queued', '31942', '061977228656', 'IT-Wn5TgY2bXc9D', (SELECT max(id) FROM lr.imports), now() - interval '3 days' + interval '2 minutes', NULL, 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  -- Pending
  (pg_temp.u('ellie.ward@bcpcouncil.test'),    pg_temp.u('ellie.ward@bcpcouncil.test'),    'session',    'pending', '31800', '052318874406', 'IT-Lp9MvQ2sZx4R', NULL, now() - interval '10 days', now() - interval '5 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('chloe.barnes@bcpcouncil.test'),  pg_temp.u('chloe.barnes@bcpcouncil.test'),  'collection', 'pending', '31700', '009094878060', 'IT-S8EDcvXNEwhs', NULL, now() - interval '50 days', now() - interval '45 days', 3, now() - interval '3 days', pg_temp.u('john.smith@bcpcouncil.test')),
  -- Unbooked (cannot attend any session)
  (pg_temp.u('dan.hughes@bcpcouncil.test'),    pg_temp.u('dan.hughes@bcpcouncil.test'),    'session',    'unbooked', '31714', '007964309768', 'IT-oCyYX5Lgxcez', NULL, now() - interval '30 days', now() - interval '25 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  -- Booked
  (pg_temp.u('priya.hart@bcpcouncil.test'),    pg_temp.u('priya.hart@bcpcouncil.test'),    'session',    'booked', '31877', '006943877382', 'IT-o5wESMGWkoRv', NULL, now() - interval '30 days', now() - interval '28 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('amira.shah@bcpcouncil.test'),    pg_temp.u('amira.shah@bcpcouncil.test'),    'session',    'booked', '31818', '049249813478', 'IT-dZ4U2KWoWLXE', NULL, now() - interval '40 days', now() - interval '38 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('owen.price@bcpcouncil.test'),    pg_temp.u('owen.price@bcpcouncil.test'),    'collection', 'booked', '31802', '090764653893', 'IT-q7VgkdMUDYnA', NULL, now() - interval '40 days', now() - interval '38 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('marcus.hale@bcpcouncil.test'),   pg_temp.u('marcus.hale@bcpcouncil.test'),   'collection', 'booked', '31834', '012678233303', 'IT-W2pXr7KcNm4D', NULL, now() - interval '35 days', now() - interval '33 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  -- Someone else receiving the laptop: the case is in Sam's name, Adam is the Halo assigned user
  (pg_temp.u('sam.taylor@bcpcouncil.test'),    pg_temp.u('adam.kerr@bcpcouncil.test'),     'collection', 'booked', '31958', '041587226390', 'IT-Tq8MvR2sXk7N', NULL, now() - interval '8 days', NULL, 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  -- Rebook required (the team cancelled the session)
  (pg_temp.u('ravi.menon@bcpcouncil.test'),    pg_temp.u('ravi.menon@bcpcouncil.test'),    'collection', 'rebook_required', '31697', '010760716353', 'IT-cF4qvGXKAnTS', NULL, now() - interval '45 days', now() - interval '43 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  -- Awaiting return, awaiting decommission
  (pg_temp.u('nadia.kowalski@bcpcouncil.test'), pg_temp.u('nadia.kowalski@bcpcouncil.test'), 'collection', 'awaiting_return', '31675', '030173995589', 'IT-ZWZNARoPXFgD', NULL, now() - interval '60 days', now() - interval '58 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('kate.morris@bcpcouncil.test'),   pg_temp.u('kate.morris@bcpcouncil.test'),   'collection', 'awaiting_decommission', '31670', '008151666649', 'IT-MdJFeeNj3swm', NULL, now() - interval '60 days', now() - interval '58 days', 0, NULL, pg_temp.u('john.smith@bcpcouncil.test'));

-- Completed and withdrawn need closed_at (and a reason) as they go in.
INSERT INTO lr.cases (user_id, halo_assigned_user_id, session_type, status, old_asset_id, old_serial, old_hostname,
                      queued_at, invited_at, closed_at, withdrawn_reason, created_by)
VALUES
  (pg_temp.u('tom.fielding@bcpcouncil.test'), pg_temp.u('tom.fielding@bcpcouncil.test'), 'session', 'completed', '31620', '058821340192', 'IT-Kx2NcB7pQe5W',
   now() - interval '80 days', now() - interval '78 days', now() - interval '10 days', NULL, pg_temp.u('john.smith@bcpcouncil.test')),
  (pg_temp.u('leah.turner@bcpcouncil.test'),  pg_temp.u('leah.turner@bcpcouncil.test'),  'collection', 'withdrawn', '31655', '052497844013', 'IT-99W6SVBnkBj3',
   now() - interval '50 days', now() - interval '48 days', now() - interval '20 days', 'Left the council', pg_temp.u('john.smith@bcpcouncil.test'));

-- Flags
UPDATE lr.cases SET flag_kind = 'reminders', flag_reason = '3 reminders', flagged_at = now() - interval '3 days'
WHERE id = pg_temp.c('31700');
UPDATE lr.cases SET flag_kind = 'unavailable', flag_reason = 'Unavailable for sessions', flagged_at = now() - interval '6 days', reminders_paused = true
WHERE id = pg_temp.c('31714');
UPDATE lr.cases SET flag_kind = 'manual', flag_reason = 'On annual leave until 23 November',
                    flagged_by = pg_temp.u('john.smith@bcpcouncil.test'), flagged_at = now() - interval '1 day',
                    rebook_requested_at = now() - interval '1 day'
WHERE id = pg_temp.c('31697');

INSERT INTO lr.availability_requests (case_id, reason, availability, software_requested, submitted_at)
VALUES (pg_temp.c('31714'), 'non_standard_hours',
        'I work nights, Sunday to Thursday. Any weekday after 3pm works for me.',
        ARRAY['Adobe Acrobat Pro', 'ArcGIS Pro', 'Planning Portal connector'], now() - interval '6 days');


-- Devices: allocations, step completion and progress ---------------------

UPDATE lr.cases c SET box_number = v.box
FROM (VALUES ('31877', '45855'), ('31818', '45821'), ('31802', '45790'), ('31834', '45848'),
             ('31697', '45770'), ('31675', '45712'), ('31670', '45708'), ('31620', '45650')) AS v(asset, box)
WHERE c.old_asset_id = v.asset;

-- Open allocations for cases not yet completed at step 4.
INSERT INTO lr.device_allocations (box_number, case_id, allocated_at, allocated_by)
SELECT box_number, id, now() - interval '5 days', pg_temp.u('john.smith@bcpcouncil.test')
FROM lr.cases WHERE old_asset_id IN ('31877', '31818', '31802', '31834', '31697');

-- Issued boxes (replacement completed).
INSERT INTO lr.device_allocations (box_number, case_id, allocated_at, allocated_by, removed_at, removed_by, outcome)
SELECT box_number, id, now() - interval '20 days', pg_temp.u('john.smith@bcpcouncil.test'),
       now() - interval '13 days', pg_temp.u('john.smith@bcpcouncil.test'), 'issued'
FROM lr.cases WHERE old_asset_id IN ('31675', '31670', '31620');

-- Device preparation checks (step 2), copied per box, then ticked.
SELECT lr.copy_checklist(id, 'device_preparation', box_number)
FROM lr.cases WHERE old_asset_id IN ('31877', '31818', '31802', '31834', '31675', '31670', '31620');

UPDATE lr.case_checks SET ticked = true, ticked_by = pg_temp.u('john.smith@bcpcouncil.test'), ticked_at = now() - interval '2 days'
WHERE step = 'device_preparation'
  AND (case_id IN (SELECT id FROM lr.cases WHERE old_asset_id IN ('31818', '31802', '31834', '31675', '31670', '31620'))
       OR (case_id = pg_temp.c('31877') AND sort_order <= 2));

UPDATE lr.cases SET device_prepared_at = now() - interval '2 days', device_prepared_by = pg_temp.u('john.smith@bcpcouncil.test')
WHERE old_asset_id IN ('31818', '31802', '31834', '31675', '31670', '31620');

-- Software prepared (step 3).
UPDATE lr.cases SET software_prepared = ARRAY['Adobe Acrobat Pro', 'ArcGIS Pro'],
                    software_prepared_at = now() - interval '1 day', software_prepared_by = pg_temp.u('alex.morgan@bcpcouncil.test')
WHERE old_asset_id = '31818';
UPDATE lr.cases SET software_prepared_at = now() - interval '1 day', software_prepared_by = pg_temp.u('alex.morgan@bcpcouncil.test')
WHERE old_asset_id = '31802';
UPDATE lr.cases SET software_prepared = ARRAY['Microsoft Visio'],
                    software_prepared_at = now() - interval '15 days', software_prepared_by = pg_temp.u('john.smith@bcpcouncil.test')
WHERE old_asset_id IN ('31675', '31670', '31620');

-- Attended (step 4), returned (step 5), decommissioned (step 6).
UPDATE lr.cases SET attended_at = pg_temp.at(pg_temp.past_tuesday(), '10:20')
WHERE old_asset_id IN ('31675', '31670', '31620');
UPDATE lr.cases SET old_device_returned_at = now() - interval '4 days', old_device_returned_by = pg_temp.u('john.smith@bcpcouncil.test')
WHERE old_asset_id IN ('31670', '31620');

SELECT lr.copy_checklist(id, 'decommission') FROM lr.cases WHERE old_asset_id IN ('31670', '31620');
UPDATE lr.case_checks SET ticked = true, ticked_by = pg_temp.u('john.smith@bcpcouncil.test'), ticked_at = now() - interval '3 days'
WHERE step = 'decommission'
  AND (case_id = pg_temp.c('31620') OR (case_id = pg_temp.c('31670') AND sort_order <= 2));

UPDATE lr.cases SET decommissioned_at = now() - interval '10 days', decommissioned_by = pg_temp.u('john.smith@bcpcouncil.test')
WHERE old_asset_id = '31620';


-- Bookings ---------------------------------------------------------------

-- Priya rebooked: the first booking is marked rebooked, the new one replaces it.
WITH first_booking AS (
  INSERT INTO lr.bookings (case_id, session_id, status, software_requested, created_at)
  VALUES (pg_temp.c('31877'), (SELECT id FROM seed_sessions WHERE label = 'later_session'), 'rebooked',
          ARRAY['Adobe Acrobat Pro', 'ArcGIS Pro', 'Microsoft Visio', 'Planning Portal connector'], now() - interval '20 days')
  RETURNING id
)
INSERT INTO lr.bookings (case_id, session_id, status, software_requested, replaces_booking_id, created_at)
SELECT pg_temp.c('31877'), (SELECT id FROM seed_sessions WHERE label = 'next_session'), 'booked',
       ARRAY['Adobe Acrobat Pro', 'ArcGIS Pro', 'Microsoft Visio', 'Planning Portal connector'], id, now() - interval '12 days'
FROM first_booking;

INSERT INTO lr.bookings (case_id, session_id, status, software_requested, booked_by, created_at) VALUES
  (pg_temp.c('31818'), (SELECT id FROM seed_sessions WHERE label = 'soon_session'),    'booked', ARRAY['Adobe Acrobat Pro', 'ArcGIS Pro'], NULL, now() - interval '30 days'),
  (pg_temp.c('31802'), (SELECT id FROM seed_sessions WHERE label = 'soon_collection'), 'booked', '{}', NULL, now() - interval '30 days'),
  -- Booked on Sam's behalf by the team
  (pg_temp.c('31958'), (SELECT id FROM seed_sessions WHERE label = 'next_collection'), 'booked', ARRAY['Microsoft Project'],
   pg_temp.u('john.smith@bcpcouncil.test'), now() - interval '7 days'),
  -- Ravi's booking on the session the team cancelled
  (pg_temp.c('31697'), (SELECT id FROM seed_sessions WHERE label = 'cancelled_collection'), 'cancelled', ARRAY['AutoCAD LT'],
   NULL, now() - interval '25 days'),
  -- Attended at the past collection
  (pg_temp.c('31675'), (SELECT id FROM seed_sessions WHERE label = 'past_collection'), 'attended', ARRAY['Microsoft Visio'], NULL, now() - interval '30 days'),
  (pg_temp.c('31670'), (SELECT id FROM seed_sessions WHERE label = 'past_collection'), 'attended', ARRAY['Microsoft Visio'], NULL, now() - interval '30 days'),
  (pg_temp.c('31620'), (SELECT id FROM seed_sessions WHERE label = 'past_collection'), 'attended', ARRAY['Microsoft Visio'], NULL, now() - interval '30 days');

UPDATE lr.bookings SET reason = 'Session cancelled by the team' WHERE case_id = pg_temp.c('31697');

-- Marcus has a custom appointment (no session place).
INSERT INTO lr.bookings (case_id, custom_starts_at, custom_location, custom_note, status, software_requested, booked_by, created_at)
VALUES (pg_temp.c('31834'), pg_temp.at(pg_temp.wd(3), '12:30'), 'Room B3, BCP Council Civic Centre, Bournemouth',
        'Ask at reception for Desktop Infrastructure.', 'booked', ARRAY['SPSS Statistics', 'Planning Portal connector'],
        pg_temp.u('john.smith@bcpcouncil.test'), now() - interval '4 days');


-- Journal entries ----------------------------------------------------

INSERT INTO lr.journal_entries (case_id, occurred_at, actor_user_id, actor_system, kind, body, data)
SELECT pg_temp.c(asset), at, actor, system, kind, body, data::jsonb
FROM (VALUES
  ('31877', now() - interval '28 days', NULL::uuid, 'Send invitations', 'email', 'Email sent: invitation to user', '{"email": "invitation", "result": "sent"}'),
  ('31877', now() - interval '20 days', pg_temp.u('priya.hart@bcpcouncil.test'), NULL, 'booking', 'Booked Session. Software requested: Adobe Acrobat Pro, ArcGIS Pro, Microsoft Visio, Planning Portal connector', NULL),
  ('31877', now() - interval '12 days', pg_temp.u('priya.hart@bcpcouncil.test'), NULL, 'booking', 'Session date changed', NULL),
  ('31877', now() - interval '12 days', NULL, 'Booking rebooked', 'email', 'Email sent: booking confirmation to user', '{"email": "booking_confirmed", "result": "sent"}'),
  ('31877', now() - interval '5 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'allocation', 'Device allocated: box number 45855', NULL),
  ('31877', now() - interval '2 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'checklist', 'Preparation checks saved: 2 of 4 done', NULL),
  ('31818', now() - interval '38 days', NULL, 'Send invitations', 'email', 'Email sent: invitation to user', '{"email": "invitation", "result": "sent"}'),
  ('31818', now() - interval '5 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'allocation', 'Device allocated: box number 45821', NULL),
  ('31818', now() - interval '1 day', pg_temp.u('alex.morgan@bcpcouncil.test'), NULL, 'software', 'Software prepared: Adobe Acrobat Pro, ArcGIS Pro', NULL),
  ('31700', now() - interval '45 days', NULL, 'Send invitations', 'email', 'Email sent: invitation to user', '{"email": "invitation", "result": "sent"}'),
  ('31700', now() - interval '3 days', NULL, 'Send booking reminders', 'email', 'Email sent: booking reminder to user (3rd)', '{"email": "booking_reminder", "result": "sent"}'),
  ('31700', now() - interval '3 days', NULL, 'Send booking reminders', 'flag', 'Flagged: 3 reminders sent', NULL),
  ('31714', now() - interval '6 days', pg_temp.u('dan.hughes@bcpcouncil.test'), NULL, 'availability', 'Told us when they are available: non-standard days or hours', NULL),
  ('31714', now() - interval '6 days', NULL, 'Availability request', 'email', 'Email sent: availability request received to user', '{"email": "availability_received", "result": "sent"}'),
  ('31697', now() - interval '1 day', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'booking', 'Session cancelled: Room 310 needed for an emergency planning exercise', NULL),
  ('31697', now() - interval '1 day', NULL, 'Session cancelled', 'email', 'Email sent: session cancelled to user', '{"email": "session_cancelled", "result": "sent"}'),
  ('31697', now() - interval '1 day', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'flag', 'Flagged: On annual leave until 23 November', NULL),
  ('31675', now() - interval '13 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'status', 'Replacement completed. Halo updated: box 45712 In Service', NULL),
  ('31675', now() - interval '13 days', NULL, 'Replacement completed', 'email', 'Email sent: device issued to user', '{"email": "device_issued", "result": "sent"}'),
  ('31670', now() - interval '4 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'status', 'Old device returned', NULL),
  ('31620', now() - interval '10 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'status', 'Decommissioned. Case completed', NULL),
  ('31655', now() - interval '20 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'status', 'Withdrawn: Left the council', NULL),
  ('31940', now() - interval '3 days', pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'import', 'Added to the invitation queue from the Halo report (Session)', NULL)
) AS j(asset, at, actor, system, kind, body, data);

-- A completion that failed because Halo was down: journaled with a Failed tag, nothing else changed.
INSERT INTO lr.journal_entries (case_id, occurred_at, actor_user_id, kind, body, data, outcome) VALUES
  (pg_temp.c('31818'), now() - interval '50 minutes', pg_temp.u('john.smith@bcpcouncil.test'), 'status',
   'Complete replacement failed: Halo returned 503 Service Unavailable',
   '{"connection": "halo", "status_code": 503}', 'failed');

INSERT INTO lr.device_journal (box_number, occurred_at, actor_user_id, kind, case_id, body)
SELECT box_number, now() - interval '5 days', pg_temp.u('john.smith@bcpcouncil.test'), 'allocation', id,
       'Allocated to ' || reference
FROM lr.cases WHERE box_number IS NOT NULL;


-- Connection log and email counts ------------------------------------

INSERT INTO portal.connection_log (occurred_at, connection, trigger_kind, trigger_label, actor_user_id, case_id, outcome, status_code, summary, error, duration_ms) VALUES
  (now() - interval '3 hours', 'halo',          'user',     'Refresh from Halo',  pg_temp.u('john.smith@bcpcouncil.test'), NULL, 'success', 200, 'End-of-life report: 64 laptops', NULL, 1840),
  (now() - interval '2 hours', 'halo',          'system',   'Stock list',         NULL, NULL, 'success', 200, 'Stock: 46 devices', NULL, 920),
  (now() - interval '1 hour',  'email_webhook', 'schedule', 'Daily invitations',  NULL, NULL, 'success', 202, '15 sent', NULL, 3100),
  (now() - interval '50 minutes', 'halo',        'user',    'Complete replacement', pg_temp.u('john.smith@bcpcouncil.test'), pg_temp.c('31818'), 'failed', 503, NULL, 'Halo returned 503 Service Unavailable', 10000);

-- Calls made for a case were laptop replacements' own.
UPDATE portal.connection_log SET service = 'laptop_replacements' WHERE case_id IS NOT NULL;

INSERT INTO lr.email_sends (email_key, case_id, to_address, scheduled, outcome, sent_at)
SELECT key, pg_temp.c(asset), email, scheduled, 'sent', at
FROM (VALUES
  ('invitation',        '31800', 'ellie.ward@bcpcouncil.test',   true,  now() - interval '5 days'),
  ('booking_reminder',  '31700', 'chloe.barnes@bcpcouncil.test', true,  now() - interval '3 days'),
  ('session_cancelled', '31697', 'ravi.menon@bcpcouncil.test',   false, now() - interval '1 day'),
  ('booking_confirmed', '31958', 'sam.taylor@bcpcouncil.test',   false, now() - interval '7 days')
) AS e(key, asset, email, scheduled, at);


-- Email template and emails ------------------------------------------
-- The portal email template HTML is loaded by seed-dev.mjs from
-- db/seed/portal-email-template.html (the mockups' Email template screen).

INSERT INTO lr.email_templates (key, subject, preheader, body_markdown, updated_by) VALUES
  ('session_cancelled',
   'Your laptop replacement session on {date} has been cancelled',
   'Your session on {date} is cancelled. Choose a new date.',
   E'Hello {first_name},\n\nWe are sorry, but we have had to cancel your laptop replacement session on **{date} at {time}**.\n\n## What you need to do\n\n- [Choose a new date]({booking_link})\n- Keep using your current laptop until then\n\nYour software choices have been kept. We will send you a reminder each week until you book.\n\nThank you,  \n{team_name}',
   pg_temp.u('john.smith@bcpcouncil.test'));

-- The other eight emails have no wording yet. These placeholders say so
-- plainly, so they cannot be mistaken for real content.
INSERT INTO lr.email_templates (key, subject, preheader, body_markdown)
SELECT key, '[Wording to come] ' || title, '',
       'This email has no wording yet. Ben is providing the content for every email.'
FROM (VALUES
  ('invitation', 'Invitation'),
  ('booking_reminder', 'Booking reminder'),
  ('booking_confirmed', 'Booking confirmation'),
  ('session_reminder', 'Session reminder'),
  ('rebook_needed', 'Rebook needed'),
  ('availability_received', 'Availability request received'),
  ('device_issued', 'Device issued'),
  ('return_reminder', 'Old device return reminder')
) AS t(key, title);
