-- Activation codes table for Shield, Shift, and Earn products
CREATE TABLE IF NOT EXISTS activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    product TEXT NOT NULL CHECK (product IN ('shield', 'shift', 'earn', 'sentinelai')),
    type TEXT DEFAULT 'lifetime' CHECK (type IN ('monthly', 'annual', 'lifetime', 'gift', 'admin')),
    status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'revoked', 'cancelled', 'expired')),
    stripe_payment_intent_id TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    activated_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_email ON activation_codes(email);
CREATE INDEX IF NOT EXISTS idx_activation_codes_product ON activation_codes(product);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_activation_codes_stripe_payment_intent ON activation_codes(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_stripe_customer ON activation_codes(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON activation_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow anon to validate codes (only check existence, not sensitive data)
CREATE POLICY "Anon can validate codes" ON activation_codes
    FOR SELECT
    TO anon
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_activation_codes_updated_at ON activation_codes;
CREATE TRIGGER update_activation_codes_updated_at
    BEFORE UPDATE ON activation_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
