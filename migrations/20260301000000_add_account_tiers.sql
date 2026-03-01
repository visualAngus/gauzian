CREATE table account_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    storage_limit_bytes BIGINT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO account_tiers (name, description, storage_limit_bytes, price) VALUES
('free', 'Basic tier with limited features', 2 * 1024 * 1024 * 1024, 0.00),
('pro', 'Advanced tier with more features', 25 * 1024 * 1024 * 1024, 9.99),
('premium', 'Full access to all features', 100 * 1024 * 1024 * 1024, 29.99),
('ultra', 'Unlimited storage and priority support', 200 * 1024 * 1024 * 1024, 99.99);

ALTER TABLE users ADD COLUMN account_tier_id UUID REFERENCES account_tiers(id) DEFAULT (SELECT id FROM account_tiers WHERE name = 'free');

UPDATE users SET account_tier_id = (SELECT id FROM account_tiers WHERE name = 'free') WHERE account_tier_id IS NULL;

ALTER TABLE users ALTER COLUMN account_tier_id SET NOT NULL;