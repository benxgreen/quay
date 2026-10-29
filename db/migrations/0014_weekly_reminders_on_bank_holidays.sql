-- =====================================================================
-- 0014_weekly_reminders_on_bank_holidays.sql
--
-- Weekly emails (booking reminders, rebook reminders, old device return
-- reminders) go out on their weekday, Monday by default. When that day is
-- a bank holiday they go out on the next working day instead (decided
-- 29 Oct 2026). Invitations and session reminders already run on working
-- days only.
--
-- lr.is_weekly_send_day is what both the 9am jobs and lr.email_forecast
-- use to decide whether today is the day, so the forecast always matches
-- what the jobs do. The app passes the bank holidays from the GOV.UK feed.
-- =====================================================================

-- p_day if it is a working day, otherwise the next working day after it.
CREATE FUNCTION lr.next_working_day(p_day date, p_bank_holidays date[])
RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN extract(isodow FROM p_day) BETWEEN 1 AND 5
     AND NOT (p_day = ANY (coalesce(p_bank_holidays, '{}')))
    THEN p_day
    ELSE lr.add_working_days(p_day, 1, p_bank_holidays)
  END;
$$;

-- True when weekly emails due on p_weekday (1 = Monday … 5 = Friday) go out
-- on p_day: the latest p_weekday on or before p_day, moved to the next
-- working day if it is a bank holiday, falls on p_day.
CREATE FUNCTION lr.is_weekly_send_day(p_day date, p_weekday integer, p_bank_holidays date[])
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lr.next_working_day(
           p_day - ((extract(isodow FROM p_day)::integer - p_weekday + 7) % 7),
           p_bank_holidays
         ) = p_day;
$$;

-- Same as 0013 apart from the weekly reminders, which now use
-- lr.is_weekly_send_day instead of comparing the weekday.
CREATE OR REPLACE FUNCTION lr.email_forecast(
  p_from          date,
  p_days          integer DEFAULT 5,
  p_bank_holidays date[]  DEFAULT '{}'
)
RETURNS TABLE (
  day                date,
  invitations        integer,
  booking_reminders  integer,
  rebook_reminders   integer,
  session_reminders  integer,
  return_reminders   integer,
  total              integer
)
LANGUAGE sql STABLE AS $$
  WITH s AS (SELECT * FROM lr.settings WHERE id = 1),
  days AS (
    SELECT d::date AS day, (row_number() OVER (ORDER BY d))::integer AS n
    FROM generate_series(p_from,
                         p_from + p_days * 2 + 14 + coalesce(cardinality(p_bank_holidays), 0),
                         interval '1 day') AS d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5
      AND NOT (d::date = ANY (coalesce(p_bank_holidays, '{}')))
    ORDER BY d
    LIMIT p_days
  ),
  queued AS (SELECT count(*)::integer AS q FROM lr.cases WHERE status = 'queued'),
  f AS (
    SELECT d.day,
      greatest(0, least(s.invitations_per_working_day,
                        queued.q - (d.n - 1) * s.invitations_per_working_day)) AS invitations,
      CASE WHEN lr.is_weekly_send_day(d.day, s.reminder_weekday, p_bank_holidays) THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status IN ('pending', 'unbooked') AND NOT c.reminders_paused
          AND c.invited_at IS NOT NULL
          AND (c.invited_at AT TIME ZONE 'Europe/London')::date + s.first_reminder_after_days <= d.day
      ) ELSE 0 END::integer AS booking_reminders,
      CASE WHEN lr.is_weekly_send_day(d.day, s.reminder_weekday, p_bank_holidays) THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status = 'rebook_required'
          AND (c.rebook_requested_at AT TIME ZONE 'Europe/London')::date + 7 <= d.day
      ) ELSE 0 END::integer AS rebook_reminders,
      (SELECT count(*) FROM lr.bookings b
         LEFT JOIN lr.sessions se ON se.id = b.session_id
       WHERE b.status = 'booked'
         AND (se.id IS NULL OR se.status <> 'cancelled')
         AND (coalesce(se.starts_at, b.custom_starts_at) AT TIME ZONE 'Europe/London')::date
             = lr.add_working_days(d.day, s.software_lock_working_days, p_bank_holidays)
      )::integer AS session_reminders,
      CASE WHEN s.return_reminders_enabled
            AND lr.is_weekly_send_day(d.day, s.return_reminder_weekday, p_bank_holidays) THEN (
        SELECT count(*) FROM lr.cases c
        WHERE c.status = 'awaiting_return' AND c.return_reminders
      ) ELSE 0 END::integer AS return_reminders
    FROM days d CROSS JOIN s CROSS JOIN queued
  )
  SELECT day, invitations, booking_reminders, rebook_reminders, session_reminders, return_reminders,
         invitations + booking_reminders + rebook_reminders + session_reminders + return_reminders
  FROM f
  ORDER BY day;
$$;
