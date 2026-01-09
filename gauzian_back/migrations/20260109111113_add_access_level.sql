-- Add migration script here
ALTER TABLE file_access
ADD COLUMN access_level TEXT NOT NULL DEFAULT 'read';
ALTER TABLE folder_access
ADD COLUMN access_level TEXT NOT NULL DEFAULT 'read';