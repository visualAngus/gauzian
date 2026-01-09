-- Add migration script here

ALTER TABLE users
ADD COLUMN auth_salt TEXT;