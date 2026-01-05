-- Add migration script here
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);