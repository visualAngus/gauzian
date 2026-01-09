-- Add migration script here
ALTER TABLE users ADD COLUMN private_key_salt TEXT;
ALTER TABLE users ADD COLUMN iv TEXT;