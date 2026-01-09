-- Add migration script here
ALTER TABLE s3_keys ADD COLUMN index INTEGER NOT NULL DEFAULT 0;
