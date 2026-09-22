export interface UrlRecord {
  id: number;
  shortCode: string;
  originalUrl: string;
  isCustom: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateUrlInput {
  original_url: string;
  custom_alias?: string;
  expires_in_days?: number;
}

export interface CreateUrlResponse {
  short_code: string;
  short_url: string;
  original_url: string;
  is_custom: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface ClickEvent {
  shortCode: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  timestamp: string;
}

export interface DailyClicks {
  date: string;
  clicks: number;
}

export interface DimensionMetric {
  name: string;
  count: number;
}

export interface UrlAnalyticsResponse {
  short_code: string;
  total_clicks: number;
  daily_clicks: DailyClicks[];
  browsers: DimensionMetric[];
  os: DimensionMetric[];
  devices: DimensionMetric[];
  recent_clicks: {
    clicked_at: string;
    browser: string | null;
    os: string | null;
    device: string | null;
    ip_address: string | null;
    referer: string | null;
  }[];
}
