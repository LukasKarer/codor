-- ============================================================
-- organisations table
-- One row per organisation. Holds org-level data and a list of
-- admin user IDs (auth.users UUIDs) who can manage it.
-- Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admins jsonb NOT NULL DEFAULT '[]'::jsonb,
  data   jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- profiles table
-- One row per Supabase auth user. Holds role flags.
-- Auto-created (idempotent upsert) on first POST /v1/users/new.
-- Flags default to false; flip manually in DB to grant roles.
-- organisation_id: FK to which org the user belongs (nullable).
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  auth_user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_teacher        boolean NOT NULL DEFAULT false,
  is_admin          boolean NOT NULL DEFAULT false,
  organisation_id   uuid REFERENCES organisations(id) ON DELETE SET NULL
);

-- Add organisation_id column to profiles if it does not exist yet
-- (safe to run on an existing DB that was created before this migration)
DO $$
BEGIN
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
-- content column stores exercise description / starter code.
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sub           TEXT   NOT NULL UNIQUE,
  creation_time BIGINT NOT NULL,
  content       TEXT   DEFAULT ''
);

-- ============================================================
-- entries table (enrollment log)
-- One row per (auth_user_id, exercise_id) for real students;
-- test sessions (teacher "Try as Student") always insert a new row.
-- id        : auto-generated UUID (primary key)
-- sub       : random opaque token used in public-facing URLs
-- auth_user_id : Supabase auth UUID (nullable for legacy rows)
-- is_test   : true for teacher test sessions
-- content   : last pushed code (saved editor state)
-- note      : teacher-assigned grade (nullable)
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
