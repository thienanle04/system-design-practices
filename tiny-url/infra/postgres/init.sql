-- Initialize schema for TinyURL system

CREATE TABLE IF NOT EXISTS kgs_keys (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL, -- 'AVAILABLE', 'ALLOCATED', 'USED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kgs_keys_status_id ON kgs_keys (status, id);

CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(50) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls (short_code);
CREATE INDEX IF NOT EXISTS idx_urls_is_active ON urls (is_active);

CREATE TABLE IF NOT EXISTS url_clicks (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(50),
    os VARCHAR(50),
    device VARCHAR(50),
    referer TEXT,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_url_clicks_short_code ON url_clicks (short_code);
CREATE INDEX IF NOT EXISTS idx_url_clicks_clicked_at ON url_clicks (clicked_at);

CREATE TABLE IF NOT EXISTS url_analytics_daily (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    clicks INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT uq_short_code_date UNIQUE(short_code, date)
);

CREATE INDEX IF NOT EXISTS idx_url_analytics_daily_code ON url_analytics_daily (short_code);
