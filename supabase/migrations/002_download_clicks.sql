-- Download tracking table
CREATE TABLE IF NOT EXISTS download_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product TEXT NOT NULL,
    page TEXT,
    user_agent TEXT,
    referrer TEXT,
    ip_hash TEXT,  -- Hashed IP for privacy
    country TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_download_clicks_product ON download_clicks(product);
CREATE INDEX IF NOT EXISTS idx_download_clicks_page ON download_clicks(page);
CREATE INDEX IF NOT EXISTS idx_download_clicks_clicked_at ON download_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_download_clicks_product_clicked_at ON download_clicks(product, clicked_at);

-- Enable Row Level Security
ALTER TABLE download_clicks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON download_clicks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow anon to insert (for tracking)
CREATE POLICY "Anon can insert download clicks" ON download_clicks
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anon to select (for dashboard aggregation)
CREATE POLICY "Anon can read download clicks" ON download_clicks
    FOR SELECT
    TO anon
    USING (true);

-- Materialized view for download analytics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS download_stats_daily AS
SELECT 
    product,
    DATE(clicked_at) as date,
    COUNT(*) as click_count,
    COUNT(DISTINCT ip_hash) as unique_clickers
FROM download_clicks
WHERE clicked_at > NOW() - INTERVAL '90 days'
GROUP BY product, DATE(clicked_at);

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_download_stats_daily_product_date ON download_stats_daily(product, date);
