-- =====================================================================
-- 0011_roles_and_emails.sql
--
-- 1. Roles per service. Laptop replacements are run by Desktop
--    Infrastructure and smartphone replacements by Governance &
--    Compliance, so each service has its own team and admin role.
--    The old replacements_* roles become the laptop roles.
--
-- 2. Emails.
--    portal.email_template  the HTML every email is sent in. {content}
--                           is where the email goes; {preheader} and
--                           {team_name} are filled in when it is sent.
--    lr.email_templates     one row per laptop replacement email: subject,
--                           preheader and Markdown message.
--    lr.settings            the team name and the mailbox emails are sent
--                           from.
--    The portal renders the final subject and HTML and posts them to the
--    one Power Automate flow, which only sends.
-- =====================================================================

-- 1. Roles ------------------------------------------------------------

ALTER TABLE portal.user_roles DROP CONSTRAINT user_roles_role_check;

UPDATE portal.user_roles SET role = 'laptops_team'  WHERE role = 'replacements_team';
UPDATE portal.user_roles SET role = 'laptops_admin' WHERE role = 'replacements_admin';
UPDATE portal.user_role_history SET role = 'laptops_team'  WHERE role = 'replacements_team';
UPDATE portal.user_role_history SET role = 'laptops_admin' WHERE role = 'replacements_admin';

ALTER TABLE portal.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (
  'administrator',       -- portal-wide: Portal settings, Users, Connections
  'laptops_team',        -- Desktop Infrastructure
  'laptops_admin',
  'smartphones_team',    -- Governance & Compliance
  'smartphones_admin',
  'new_starters_team'
));

-- 2. Emails -----------------------------------------------------------

CREATE TABLE portal.email_template (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  html        text NOT NULL CHECK (position('{content}' IN html) > 0),
  updated_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lr.settings
  ADD COLUMN team_name  text NOT NULL DEFAULT 'Desktop Infrastructure',
  ADD COLUMN sent_from  text NOT NULL DEFAULT 'desktopinfrastructure@bcpcouncil.gov.uk'
    CHECK (sent_from LIKE '%@%');

CREATE TABLE lr.email_templates (
  key            text PRIMARY KEY CHECK (key IN (
                   'invitation', 'booking_reminder', 'booking_confirmed',
                   'session_reminder', 'session_cancelled', 'rebook_needed',
                   'availability_received', 'device_issued', 'return_reminder')),
  subject        text NOT NULL,
  preheader      text NOT NULL DEFAULT '' CHECK (char_length(preheader) <= 90),
  body_markdown  text NOT NULL,
  updated_by     uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
