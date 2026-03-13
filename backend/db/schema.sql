-- ============================================================
-- profiles table
-- One row per Supabase auth user. Holds role flags.
-- Auto-created (idempotent upsert) on first POST /v1/users/new.
-- Flags default to false; flip manually in DB to grant roles.
-- ============================================================
CREATE TABLE profiles (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_teacher   boolean NOT NULL DEFAULT false,
  is_admin     boolean NOT NULL DEFAULT false
);

-- ============================================================
-- exercises table
-- content column stores exercise description / starter code.
-- ============================================================
CREATE TABLE exercises (
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
CREATE TABLE entries (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sub           TEXT    NOT NULL UNIQUE,
  exercise_id   BIGINT  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  creation_time BIGINT  NOT NULL,
  auth_user_id  uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test       boolean NOT NULL DEFAULT false,
  note          INT     DEFAULT NULL,
  content       TEXT    DEFAULT NULL
);

CREATE INDEX idx_entries_exercise_id  ON entries(exercise_id);
CREATE INDEX idx_entries_auth_user_id ON entries(auth_user_id);
