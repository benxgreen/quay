-- =====================================================================
-- 0003_lr.sql — laptop replacements
--
-- Conventions
--   * Every name is schema-qualified (lr.cases, portal.users). Never rely
--     on search_path: PgBouncer in transaction mode does not keep SET
--     between queries.
--   * Choice lists are text + CHECK, not enum types, so adding a status
--     is ALTER TABLE ... DROP/ADD CONSTRAINT rather than ALTER TYPE.
--   * Times are timestamptz; set the server timezone to Europe/London.
--   * session_type is 'collection' or 'session' everywhere.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------

-- One row of typed settings rather than a key/value table, so every
-- setting has a real type, a default and a constraint.
CREATE TABLE lr.settings (
  id                          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  invitations_per_working_day integer  NOT NULL DEFAULT 15 CHECK (invitations_per_working_day > 0),
  first_reminder_after_days   integer  NOT NULL DEFAULT 21 CHECK (first_reminder_after_days >= 0),
  reminder_weekday            smallint NOT NULL DEFAULT 1  CHECK (reminder_weekday BETWEEN 1 AND 5), -- 1 = Monday
  flag_after_reminders        integer  NOT NULL DEFAULT 2  CHECK (flag_after_reminders >= 0),
  booking_lead_working_days   integer  NOT NULL DEFAULT 5  CHECK (booking_lead_working_days >= 0),
  software_lock_working_days  integer  NOT NULL DEFAULT 3  CHECK (software_lock_working_days >= 0),
  archive_after               interval NOT NULL DEFAULT '1 month',
  updated_by                  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO lr.settings DEFAULT VALUES;

CREATE TABLE lr.session_defaults (
  session_type  text PRIMARY KEY CHECK (session_type IN ('collection', 'session')),
  start_time    time    NOT NULL,
  capacity      integer NOT NULL CHECK (capacity > 0),
  location      text    NOT NULL,
  updated_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Software shown as checkboxes. Bookings store the NAMES they picked, so
-- renaming or removing an item never rewrites history.
CREATE TABLE lr.software (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  hint        text,                                -- shown under the checkbox
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX software_name_key ON lr.software (lower(name));

-- Device preparation checks (step 2) and decommission checklist (step 6).
-- Never deleted: set active = false so old case copies still make sense.
CREATE TABLE lr.checklist_items (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list        text NOT NULL CHECK (list IN ('device_preparation', 'decommission')),
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

-- Markdown shown on the colleague's page, one per session type.
CREATE TABLE lr.page_content (
  session_type  text PRIMARY KEY CHECK (session_type IN ('collection', 'session')),
  body_markdown text NOT NULL DEFAULT '',
  updated_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lr.faqs (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question         text NOT NULL,
  answer_markdown  text NOT NULL,
  shown_for        text[] NOT NULL
                   CHECK (cardinality(shown_for) > 0
                          AND shown_for <@ ARRAY['collection', 'session']),
  sort_order       integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  updated_by       uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Devices replaced before the portal (from the old workbook), used by the
-- import screen's "replaced before" check.
CREATE TABLE lr.previous_replacements (
  old_asset_id  text PRIMARY KEY,
  old_serial    text,
  completed_on  date
);


-- ---------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------

CREATE TABLE lr.sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_type  text    NOT NULL CHECK (session_type IN ('collection', 'session')),
  starts_at     timestamptz NOT NULL,
  capacity      integer NOT NULL CHECK (capacity > 0),
  location      text    NOT NULL,
  status        text    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'cancelled')),
  -- Kept up to date by the trigger on lr.bookings. "Full" is
  -- booked_count = capacity; there is no Full status to keep in sync.
  booked_count  integer NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- The overbooking guard. Two people booking the last place at once:
  -- the second UPDATE waits for the first, then fails this check.
  CONSTRAINT sessions_not_overbooked CHECK (booked_count BETWEEN 0 AND capacity)
);
CREATE INDEX sessions_starts_at_idx ON lr.sessions (starts_at);

CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON lr.sessions
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();


-- ---------------------------------------------------------------------
-- Imports and cases
-- ---------------------------------------------------------------------

CREATE TABLE lr.imports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name    text NOT NULL,
  imported_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  rows_total   integer NOT NULL DEFAULT 0,
  rows_queued  integer NOT NULL DEFAULT 0
);

CREATE TABLE lr.cases (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference          text GENERATED ALWAYS AS ('LR-' || lpad(id::text, 6, '0')) STORED,

  -- People. The case is always against the assigned user in Halo; the
  -- recipient is only set when someone else is receiving the laptop.
  user_id            uuid NOT NULL REFERENCES portal.users (id),
  recipient_user_id  uuid REFERENCES portal.users (id),

  session_type       text NOT NULL CHECK (session_type IN ('collection', 'session')),
  status             text NOT NULL DEFAULT 'queued' CHECK (status IN (
                       'queued', 'pending', 'unbooked', 'booked', 'rebook_required',
                       'awaiting_return', 'awaiting_decommission',
                       'completed', 'withdrawn')),

  -- Old device, from the Halo report.
  old_asset_id       text NOT NULL,
  old_serial         text,
  old_hostname       text,

  -- Replacement device: Halo asset ID of the allocated box.
  box_number         text,
  software_prepared  text[] NOT NULL DEFAULT '{}',

  -- Invitations and reminders.
  import_id          bigint REFERENCES lr.imports (id) ON DELETE SET NULL,
  queued_at          timestamptz NOT NULL DEFAULT now(),
  invited_at         timestamptz,
  reminders_sent     integer NOT NULL DEFAULT 0 CHECK (reminders_sent >= 0),
  last_reminder_at   timestamptz,
  reminders_paused   boolean NOT NULL DEFAULT false,  -- true while an availability request is open

  -- Flag. NULL kind = not flagged.
  flag_kind          text CHECK (flag_kind IN ('reminders', 'manual', 'unavailable')),
  flag_reason        text,
  flagged_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL = system
  flagged_at         timestamptz,

  -- Progress.
  rebook_requested_at       timestamptz,
  attended_at               timestamptz,
  old_device_returned_at    timestamptz,
  old_device_returned_by    uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  return_reminders          boolean NOT NULL DEFAULT true,
  decommissioned_at         timestamptz,
  decommissioned_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  closed_at                 timestamptz,   -- completed or withdrawn; archiving works from this
  withdrawn_reason          text,

  -- Only a hash of the emailed booking link token is stored.
  booking_token_hash text,

  created_by  uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cases_flag_complete
    CHECK ((flag_kind IS NULL) = (flagged_at IS NULL)),
  CONSTRAINT cases_closed_at_matches_status
    CHECK ((status IN ('completed', 'withdrawn')) = (closed_at IS NOT NULL)),
  CONSTRAINT cases_withdrawn_needs_reason
    CHECK (status <> 'withdrawn' OR withdrawn_reason IS NOT NULL),
  CONSTRAINT cases_recipient_differs
    CHECK (recipient_user_id IS NULL OR recipient_user_id <> user_id)
);

-- One open case per old device.
CREATE UNIQUE INDEX cases_one_open_per_device
  ON lr.cases (old_asset_id) WHERE status NOT IN ('completed', 'withdrawn');
-- A replacement box can only be allocated to one open case.
CREATE UNIQUE INDEX cases_one_open_per_box
  ON lr.cases (box_number) WHERE box_number IS NOT NULL AND status NOT IN ('completed', 'withdrawn');

CREATE INDEX cases_status_idx    ON lr.cases (status);
CREATE INDEX cases_user_idx      ON lr.cases (user_id);
CREATE INDEX cases_recipient_idx ON lr.cases (recipient_user_id);
CREATE INDEX cases_flagged_idx   ON lr.cases (flagged_at) WHERE flag_kind IS NOT NULL;
CREATE INDEX cases_closed_idx    ON lr.cases (closed_at);

CREATE TRIGGER cases_updated_at BEFORE UPDATE ON lr.cases
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();


-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------

-- A booking is either a place on a published session, or a custom
-- appointment with its own time and location (session_id NULL).
CREATE TABLE lr.bookings (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  session_id          bigint REFERENCES lr.sessions (id),
  custom_starts_at    timestamptz,
  custom_location     text,
  custom_note         text,              -- added to the confirmation email
  status              text NOT NULL DEFAULT 'booked' CHECK (status IN (
                        'booked', 'rebooked', 'cancelled',
                        'did_not_attend', 'unsuccessful', 'attended')),
  software_requested  text[] NOT NULL DEFAULT '{}',
  software_changed_at timestamptz,
  booked_by           uuid REFERENCES portal.users (id) ON DELETE SET NULL,  -- NULL = the colleague
  replaces_booking_id bigint REFERENCES lr.bookings (id),
  reason              text,              -- cancelled / did not attend / unsuccessful
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_session_or_custom CHECK (
    (session_id IS NOT NULL AND custom_starts_at IS NULL AND custom_location IS NULL)
    OR
    (session_id IS NULL AND custom_starts_at IS NOT NULL AND custom_location IS NOT NULL)
  )
);

-- Only one live booking per case.
CREATE UNIQUE INDEX bookings_one_active_per_case
  ON lr.bookings (case_id) WHERE status = 'booked';
CREATE INDEX bookings_session_idx ON lr.bookings (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX bookings_custom_idx  ON lr.bookings (custom_starts_at) WHERE session_id IS NULL;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION portal.set_updated_at();

-- Before a booking lands on a session: the session must be open and of
-- the same type as the case.
CREATE FUNCTION lr.bookings_check_session() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  s_type   text;
  s_status text;
  c_type   text;
BEGIN
  IF NEW.session_id IS NULL OR NEW.status <> 'booked' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
                      AND OLD.status = 'booked' THEN
    RETURN NEW;
  END IF;

  SELECT session_type, status INTO s_type, s_status FROM lr.sessions WHERE id = NEW.session_id;
  SELECT session_type INTO c_type FROM lr.cases WHERE id = NEW.case_id;

  IF s_status <> 'open' THEN
    RAISE EXCEPTION 'Session % is not open', NEW.session_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_session_open';
  END IF;
  IF s_type <> c_type THEN
    RAISE EXCEPTION 'Session % is a %, but case % is a %', NEW.session_id, s_type, NEW.case_id, c_type
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_session_type_matches';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_check_session BEFORE INSERT OR UPDATE OF session_id, status ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION lr.bookings_check_session();

-- After any change, keep lr.sessions.booked_count right. If the session
-- is full, the +1 breaks sessions_not_overbooked and the whole booking
-- transaction rolls back.
CREATE FUNCTION lr.bookings_sync_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'booked' AND OLD.session_id IS NOT NULL THEN
    UPDATE lr.sessions SET booked_count = booked_count - 1 WHERE id = OLD.session_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'booked' AND NEW.session_id IS NOT NULL THEN
    UPDATE lr.sessions SET booked_count = booked_count + 1 WHERE id = NEW.session_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER bookings_sync_count AFTER INSERT OR UPDATE OF session_id, status OR DELETE ON lr.bookings
  FOR EACH ROW EXECUTE FUNCTION lr.bookings_sync_count();


-- ---------------------------------------------------------------------
-- Availability requests ("I cannot attend any of these dates")
-- ---------------------------------------------------------------------

CREATE TABLE lr.availability_requests (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  reason              text NOT NULL CHECK (reason IN ('non_standard_hours', 'away_for_all_dates', 'other')),
  availability        text NOT NULL,
  software_requested  text[] NOT NULL DEFAULT '{}',
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  resolution          text CHECK (resolution IN ('custom_booking', 'session_booking', 'reinvited', 'withdrawn')),
  CONSTRAINT availability_resolved_complete
    CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);
-- At most one open request per case.
CREATE UNIQUE INDEX availability_one_open_per_case
  ON lr.availability_requests (case_id) WHERE resolved_at IS NULL;


-- ---------------------------------------------------------------------
-- Case checks (the case's own copy of a checklist)
-- ---------------------------------------------------------------------

CREATE TABLE lr.case_checks (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id            bigint  NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  step               text    NOT NULL CHECK (step IN ('device_preparation', 'decommission')),
  checklist_item_id  integer REFERENCES lr.checklist_items (id) ON DELETE SET NULL,
  label              text    NOT NULL,   -- wording as copied
  sort_order         integer NOT NULL,
  ticked             boolean NOT NULL DEFAULT false,
  ticked_by          uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  ticked_at          timestamptz,
  UNIQUE (case_id, step, sort_order),
  CONSTRAINT case_checks_tick_complete CHECK (ticked = (ticked_at IS NOT NULL))
);

-- Copy the active items onto a case when it reaches step 2 or step 6.
-- Calling it twice does nothing the second time.
CREATE FUNCTION lr.copy_checklist(p_case_id bigint, p_step text) RETURNS integer
LANGUAGE sql AS $$
  WITH ins AS (
    INSERT INTO lr.case_checks (case_id, step, checklist_item_id, label, sort_order)
    SELECT p_case_id, p_step, i.id, i.label,
           row_number() OVER (ORDER BY i.sort_order, i.id)
    FROM lr.checklist_items i
    WHERE i.list = p_step AND i.active
      AND NOT EXISTS (SELECT 1 FROM lr.case_checks c
                      WHERE c.case_id = p_case_id AND c.step = p_step)
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins;
$$;


-- ---------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------

CREATE TABLE lr.journal_entries (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id       bigint NOT NULL REFERENCES lr.cases (id) ON DELETE CASCADE,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES portal.users (id) ON DELETE SET NULL,
  actor_system  text,                 -- e.g. 'Send booking reminders'
  kind          text NOT NULL CHECK (kind IN (
                  'note', 'status', 'email', 'booking', 'flag',
                  'allocation', 'checklist', 'software', 'availability', 'import')),
  body          text NOT NULL,        -- the sentence shown in the journal
  data          jsonb,                -- structured detail, e.g. email template and recipient
  CONSTRAINT journal_has_actor CHECK (actor_user_id IS NOT NULL OR actor_system IS NOT NULL)
);
CREATE INDEX journal_case_idx ON lr.journal_entries (case_id, occurred_at DESC);
