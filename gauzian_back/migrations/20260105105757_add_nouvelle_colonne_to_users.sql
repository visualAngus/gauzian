-- Add migration script here
ALTER TABLE users ADD COLUMN encrypted_settings TEXT;