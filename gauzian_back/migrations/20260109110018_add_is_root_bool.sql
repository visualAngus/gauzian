-- Add migration script here
ALTER TABLE folders ADD COLUMN is_root BOOLEAN NOT NULL DEFAULT FALSE;
