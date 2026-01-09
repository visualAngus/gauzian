-- Add migration script here
ALTER TABLE users
ADD COLUMN encrypted_record_key TEXT NOT NULL DEFAULT '';