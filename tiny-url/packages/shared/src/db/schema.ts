import { pgTable, bigserial, varchar, text, boolean, timestamp, date, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const kgsKeys = pgTable('kgs_keys', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  key: varchar('key', { length: 10 }).notNull().unique(),
  status: varchar('status', { length: 20 }).default('AVAILABLE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    statusIdIdx: index('idx_kgs_keys_status_id').on(table.status, table.id),
  };
});

export const urls = pgTable('urls', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  shortCode: varchar('short_code', { length: 50 }).notNull().unique(),
  originalUrl: text('original_url').notNull(),
  isCustom: boolean('is_custom').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => {
  return {
    shortCodeIdx: index('idx_urls_short_code').on(table.shortCode),
  };
});

export const urlClicks = pgTable('url_clicks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  shortCode: varchar('short_code', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  browser: varchar('browser', { length: 50 }),
  os: varchar('os', { length: 50 }),
  device: varchar('device', { length: 50 }),
  referer: text('referer'),
  clickedAt: timestamp('clicked_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => {
  return {
    shortCodeIdx: index('idx_url_clicks_short_code').on(table.shortCode),
    clickedAtIdx: index('idx_url_clicks_clicked_at').on(table.clickedAt),
  };
});

export const urlAnalyticsDaily = pgTable('url_analytics_daily', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  shortCode: varchar('short_code', { length: 50 }).notNull(),
  date: date('date').notNull(),
  clicks: integer('clicks').default(0).notNull()
}, (table) => {
  return {
    shortCodeDateUq: uniqueIndex('uq_short_code_date').on(table.shortCode, table.date),
    shortCodeIdx: index('idx_url_analytics_daily_code').on(table.shortCode),
  };
});
