-- ============================================================
-- organisations table
-- name           : display name of the organisation
-- admins         : JSONB array of auth.users UUIDs that are
--                  org-level admins (can edit this org's data)
-- email_patterns : JSONB array of strings/patterns; during
--                  signup at least one must match the user's
--                  email address for the org to be selectable.
--                  Each entry is a plain substring match
--                  (e.g. "@acme.com").
-- data           : arbitrary JSONB payload for the org
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL DEFAULT '',
  admins         jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  data           jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Add columns that may be missing on an existing DB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organisations'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE organisations ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organisations'
      AND column_name  = 'email_patterns'
  ) THEN
    ALTER TABLE organisations
      ADD COLUMN email_patterns jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END;
$$;

-- ============================================================
-- profiles table
-- is_teacher      : can create/manage exercises
-- is_admin        : org-level admin — can edit their own org
-- is_system_admin : super-admin — can edit everything
-- name            : display name entered at signup
-- organisation_id : FK to which org the user belongs
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  auth_user_id      uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL DEFAULT '',
  is_teacher        boolean NOT NULL DEFAULT false,
  is_admin          boolean NOT NULL DEFAULT false,
  is_system_admin   boolean NOT NULL DEFAULT false,
  organisation_id   uuid    REFERENCES organisations(id) ON DELETE SET NULL
);

-- Add columns that may be missing on an existing DB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'is_system_admin'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN is_system_admin boolean NOT NULL DEFAULT false;
  END IF;

  -- is_admin: org-level admin flag (was added later; may be missing on legacy DBs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'is_admin'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'organisation_id'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN organisation_id uuid REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ============================================================
-- exercises table
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sub           TEXT   NOT NULL UNIQUE,
  creation_time BIGINT NOT NULL,
  content       TEXT   DEFAULT ''
);

-- ============================================================
-- entries table (enrollment log)
-- ============================================================
CREATE TABLE IF NOT EXISTS entries (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sub               TEXT    NOT NULL UNIQUE,
  exercise_id       BIGINT  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  creation_time     BIGINT  NOT NULL,
  auth_user_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test           boolean NOT NULL DEFAULT false,
  note              INT     DEFAULT NULL,
  content           TEXT    DEFAULT NULL,
  submitted_at      BIGINT  DEFAULT NULL,
  submitted_content TEXT    DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_exercise_id  ON entries(exercise_id);
CREATE INDEX IF NOT EXISTS idx_entries_auth_user_id ON entries(auth_user_id);

-- Add columns that may be missing on an existing DB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'entries'
      AND column_name  = 'submitted_at'
  ) THEN
    ALTER TABLE entries ADD COLUMN submitted_at BIGINT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'entries'
      AND column_name  = 'submitted_content'
  ) THEN
    ALTER TABLE entries ADD COLUMN submitted_content TEXT DEFAULT NULL;
  END IF;
END;
$$;

-- ============================================================
-- entry_snapshots table (autosave history)
-- ============================================================
CREATE TABLE IF NOT EXISTS entry_snapshots (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id      uuid    NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  creation_time BIGINT  NOT NULL,
  content       TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_entry_snapshots_entry_id ON entry_snapshots(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_snapshots_time     ON entry_snapshots(creation_time);

-- ============================================================
-- ai_conversations table (persisted AI tutor chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          uuid    NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  creation_time     BIGINT  NOT NULL,
  prompt_type       TEXT    NOT NULL DEFAULT 'chat',
  user_message      TEXT    DEFAULT NULL,
  assistant_message TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_entry_id ON ai_conversations(entry_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_time     ON ai_conversations(creation_time);

-- ============================================================
-- student_reports table (AI-generated per-student exercise report)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_reports (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id              uuid    NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  exercise_id           BIGINT  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  creation_time         BIGINT  NOT NULL,
  score                 INT     NOT NULL,
  time_spent_minutes    INT     NOT NULL DEFAULT 0,
  ai_interactions_count INT     NOT NULL DEFAULT 0,
  report_json           jsonb   NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_student_reports_exercise_id ON student_reports(exercise_id);

-- ============================================================
-- exercise_reports table (AI-generated exercise-wide report)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_reports (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   BIGINT  NOT NULL UNIQUE REFERENCES exercises(id) ON DELETE CASCADE,
  creation_time BIGINT  NOT NULL,
  report_json   jsonb   NOT NULL DEFAULT '{}'::jsonb
);
