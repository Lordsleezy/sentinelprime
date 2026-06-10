-- Add IP address and city columns to download_clicks for geolocation tracking
ALTER TABLE download_clicks ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE download_clicks ADD COLUMN IF NOT EXISTS city TEXT;

-- Index for city-based analytics
CREATE INDEX IF NOT EXISTS idx_download_clicks_city ON download_clicks(city);
CREATE INDEX IF NOT EXISTS idx_download_clicks_country ON download_clicks(country);
