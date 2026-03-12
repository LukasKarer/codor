-- exercises table
-- content column replaces the flat-file /storage/exercises/<sub>.txt from the PHP backend
CREATE TABLE exercises (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sub           TEXT    NOT NULL UNIQUE,
    creation_time BIGINT  NOT NULL,
    content       TEXT    DEFAULT ''
);

-- users table
-- content column replaces the flat-file /storage/returns/<sub>.txt from the PHP backend
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sub           TEXT    NOT NULL UNIQUE,
    exercise_id   BIGINT  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    creation_time BIGINT  NOT NULL,
    academic_id   BIGINT  NOT NULL,
    note          INT     DEFAULT NULL,
    content       TEXT    DEFAULT NULL
);

CREATE INDEX idx_users_academic_id  ON users(academic_id);
CREATE INDEX idx_users_exercise_id  ON users(exercise_id);
