-- Add migration script here
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;