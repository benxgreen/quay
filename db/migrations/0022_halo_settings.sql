-- =====================================================================
-- 0022_halo_settings.sql
--
-- Halo's configuration moves out of the code into settings Administrators
-- and the laptop team can see and change (decided 31 Oct 2026):
--
--   portal.halo_settings   Which Halo user field gives each staff detail
--                          (username and its prefix, job title, department,
--                          manager's email, last sign-in). Portal-wide.
--   lr.halo_settings       Laptop replacements' reports, asset type, field
--                          IDs, status and lookup values, and audit notes.
--
-- A field is named by its Halo property, such as 'samaccountname', or as
-- 'custom:<id>' for a custom field. The rows start with the values found
-- in the test Halo on 30 Oct 2026, so nothing changes until someone edits
-- them. The Halo site address stays in portal.connections ('halo').
-- =====================================================================

CREATE TABLE portal.halo_settings (
  id                   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  username_field       text,
  username_prefix      text NOT NULL DEFAULT '',
  job_title_field      text,
  department_field     text,
  manager_email_field  text,
  last_sign_in_field   text,
  updated_by           uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO portal.halo_settings
  (username_field, username_prefix, job_title_field, department_field, manager_email_field, last_sign_in_field)
VALUES
  ('samaccountname', 'bcp\', NULL, 'departments', 'custom:1145', 'azure_last_login_date');

CREATE TABLE lr.halo_settings (
  id                       smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Reports (GET /Report/{id}?loadreport=true)
  eligible_report_id       integer NOT NULL,
  stock_report_id          integer,            -- NULL: list laptops at the in-stock status instead
  ids_report_id            integer,            -- ID and Serial Number for every laptop, when the eligible report has no ID column
  -- The Laptop asset type and its statuses
  laptop_type_id           integer NOT NULL,
  status_in_stock          integer NOT NULL,
  status_in_service        integer NOT NULL,
  status_out_of_service    integer NOT NULL,
  -- Laptop type fields, by Halo field ID
  field_serial             integer NOT NULL,
  field_stock_location     integer NOT NULL,
  field_stock_room         integer NOT NULL,
  field_last_audit_date    integer NOT NULL,
  field_audit_details      integer NOT NULL,
  field_last_sync          integer,
  -- Lookup option IDs written to the old device
  location_decommissioned  integer NOT NULL,
  room_returned            integer NOT NULL,
  -- Audit Details wording; {person} and {reference} are filled in
  collected_note           text NOT NULL,
  returned_note            text NOT NULL,
  updated_by               uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

INSERT INTO lr.halo_settings
  (eligible_report_id, stock_report_id, ids_report_id, laptop_type_id,
   status_in_stock, status_in_service, status_out_of_service,
   field_serial, field_stock_location, field_stock_room, field_last_audit_date, field_audit_details, field_last_sync,
   location_decommissioned, room_returned, collected_note, returned_note)
VALUES
  (566, NULL, 571, 1,
   0, 1, 9,
   117, 144, 217, 246, 251, 249,
   8, 5, 'Device collected by {person} - {reference}', 'Device returned by {person} - {reference}');

UPDATE portal.connections SET label = 'Halo site' WHERE key = 'halo';
