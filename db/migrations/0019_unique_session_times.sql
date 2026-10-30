-- A session slot can only be used once for each replacement type.
CREATE UNIQUE INDEX sessions_one_per_type_and_time
  ON lr.sessions (session_type, starts_at);
