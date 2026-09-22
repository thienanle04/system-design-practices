import {
  createKafkaConsumer,
  KAFKA_TOPICS,
  ClickEvent,
  getDbPool,
} from '@tiny-url/shared';
import { UAParser } from 'ua-parser-js';

const GROUP_ID = process.env.KAFKA_GROUP_ID || 'analytics-consumer-group';
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 2000;

interface ParsedClick {
  shortCode: string;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  referer: string | null;
  clickedAt: string;
  dateStr: string; // YYYY-MM-DD
}

let buffer: ParsedClick[] = [];
let isFlushing = false;

function parseUserAgent(uaString?: string) {
  if (!uaString) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  }
  const parser = new UAParser(uaString);
  const browser = parser.getBrowser().name || 'Unknown';
  const os = parser.getOS().name || 'Unknown';
  const deviceType = parser.getDevice().type || 'Desktop';
  const device = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  return { browser, os, device };
}

async function flushBuffer(): Promise<void> {
  if (buffer.length === 0 || isFlushing) return;

  isFlushing = true;
  const itemsToFlush = [...buffer];
  buffer = [];

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bulk Insert into url_clicks
    const clickValues: any[] = [];
    const clickPlaceholders: string[] = [];

    itemsToFlush.forEach((item, idx) => {
      const offset = idx * 7;
      clickPlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );
      clickValues.push(
        item.shortCode,
        item.ipAddress,
        item.userAgent,
        item.browser,
        item.os,
        item.device,
        item.referer
      );
    });

    await client.query(
      `INSERT INTO url_clicks (short_code, ip_address, user_agent, browser, os, device, referer)
       VALUES ${clickPlaceholders.join(', ')}`,
      clickValues
    );

    // 2. Aggregate counts per (short_code, date) and UPSERT into url_analytics_daily
    const countsMap = new Map<string, { shortCode: string; date: string; count: number }>();
    for (const item of itemsToFlush) {
      const key = `${item.shortCode}#${item.dateStr}`;
      const existing = countsMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        countsMap.set(key, { shortCode: item.shortCode, date: item.dateStr, count: 1 });
      }
    }

    for (const entry of countsMap.values()) {
      await client.query(
        `INSERT INTO url_analytics_daily (short_code, date, clicks)
         VALUES ($1, $2, $3)
         ON CONFLICT (short_code, date)
         DO UPDATE SET clicks = url_analytics_daily.clicks + EXCLUDED.clicks`,
        [entry.shortCode, entry.date, entry.count]
      );
    }

    await client.query('COMMIT');
    console.log(`[Analytics-Consumer] Flushed micro-batch of ${itemsToFlush.length} clicks to PostgreSQL`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Analytics-Consumer] Failed to flush click batch:', err);
    // Re-insert un-flushed items to front of buffer
    buffer = [...itemsToFlush, ...buffer];
  } finally {
    client.release();
    isFlushing = false;
  }
}

async function main() {
  console.log('[Analytics-Consumer] Service starting up...');
  const consumer = createKafkaConsumer(GROUP_ID);

  await consumer.connect();
  console.log('[Analytics-Consumer] Connected to Kafka');

  await consumer.subscribe({
    topic: KAFKA_TOPICS.URL_CLICKS,
    fromBeginning: false,
  });

  // Scheduled timer flush every FLUSH_INTERVAL_MS
  setInterval(async () => {
    await flushBuffer();
  }, FLUSH_INTERVAL_MS);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      try {
        const event: ClickEvent = JSON.parse(message.value.toString());
        const { browser, os, device } = parseUserAgent(event.userAgent);
        const dateStr = new Date(event.timestamp).toISOString().split('T')[0];

        buffer.push({
          shortCode: event.shortCode,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
          browser,
          os,
          device,
          referer: event.referer || null,
          clickedAt: event.timestamp,
          dateStr,
        });

        if (buffer.length >= BATCH_SIZE) {
          await flushBuffer();
        }
      } catch (err) {
        console.error('[Analytics-Consumer] Error processing message:', err);
      }
    },
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Analytics-Consumer] Shutting down, flushing remaining buffer...');
    await flushBuffer();
    await consumer.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Analytics-Consumer] Fatal error:', err);
  process.exit(1);
});
