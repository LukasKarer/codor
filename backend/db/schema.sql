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
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sub           TEXT    NOT NULL UNIQUE,
  exercise_id   BIGINT  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  creation_time BIGINT  NOT NULL,
  auth_user_id  uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test       boolean NOT NULL DEFAULT false,
  note          INT     DEFAULT NULL,
  content       TEXT    DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_exercise_id  ON entries(exercise_id);
CREATE INDEX IF NOT EXISTS idx_entries_auth_user_id ON entries(auth_user_id);
