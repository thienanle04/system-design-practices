import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import {
  getDb,
  urls,
  urlClicks,
  urlAnalyticsDaily,
  getAvailableKeyFromRedis,
  getUrlFromCache,
  setUrlInCache,
  setNegativeCache,
  deleteUrlFromCache,
  REDIS_KEYS,
  publishClickEvent,
  eq,
  sql,
  desc,
} from '@tiny-url/shared';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'api-instance';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

await app.register(cors, {
  origin: true,
});

// Schema validation
const createUrlSchema = z.object({
  original_url: z.string().url('Invalid URL format. Must start with http:// or https://'),
  custom_alias: z
    .string()
    .min(3, 'Custom alias must be at least 3 characters')
    .max(30, 'Custom alias must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Custom alias can only contain alphanumeric characters, hyphens, and underscores')
    .optional(),
  expires_in_days: z.number().int().positive().optional(),
});

// Health check endpoint
app.get('/health', async (request, reply) => {
  return reply.send({
    status: 'ok',
    instance: INSTANCE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Create Short URL
app.post('/api/v1/urls', async (request, reply) => {
  const parseResult = createUrlSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { original_url, custom_alias, expires_in_days } = parseResult.data;
  const db = getDb();

  let shortCode: string;
  let isCustom = false;

  if (custom_alias) {
    isCustom = true;
    shortCode = custom_alias;

    // Check if custom alias already exists in database
    const [existing] = await db
      .select({ id: urls.id })
      .from(urls)
      .where(eq(urls.shortCode, shortCode))
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: 'Custom alias is already taken. Please choose another.',
      });
    }

    // Invalidate any potential negative cache in Redis for this alias
    await deleteUrlFromCache(shortCode);
  } else {
    // Obtain key from KGS Redis buffer
    const key = await getAvailableKeyFromRedis();
    if (key) {
      shortCode = key;
    } else {
      // Fallback if Redis queue temporarily empty
      shortCode = Math.random().toString(36).substring(2, 9);
    }
  }

  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
    : null;

  try {
    const [inserted] = await db
      .insert(urls)
      .values({
        shortCode,
        originalUrl: original_url,
        isCustom,
        expiresAt,
      })
      .returning();

    // Warm Redis cache (TTL in seconds: 24 hours or until link expiration)
    let ttlSeconds = 86400;
    if (expiresAt) {
      const remainingSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      ttlSeconds = Math.max(1, Math.min(86400, remainingSeconds));
    }

    // Store in format: originalUrl (if expiresAt exists, we also check it on lookup)
    await setUrlInCache(shortCode, original_url, ttlSeconds);

    return reply.status(201).send({
      short_code: inserted.shortCode,
      short_url: `${BASE_URL}/${inserted.shortCode}`,
      original_url: inserted.originalUrl,
      is_custom: inserted.isCustom,
      expires_at: inserted.expiresAt ? inserted.expiresAt.toISOString() : null,
      created_at: inserted.createdAt.toISOString(),
      served_by: INSTANCE_NAME,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      // Unique constraint violation
      return reply.status(409).send({
        error: 'Short code already exists. Please retry.',
      });
    }
    app.log.error(err, 'Failed to create URL');
    return reply.status(500).send({
      error: 'Internal server error',
    });
  }
});

// Analytics Endpoint
app.get('/api/v1/urls/:code/analytics', async (request, reply) => {
  const { code } = request.params as { code: string };
  const db = getDb();

  // Verify short code exists
  const [urlRecord] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!urlRecord) {
    return reply.status(404).send({ error: 'Short URL not found' });
  }

  // 1. Total clicks
  const [totalResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(urlClicks)
    .where(eq(urlClicks.shortCode, code));

  // 2. Daily clicks
  const dailyResults = await db
    .select({
      date: sql<string>`to_char(${urlAnalyticsDaily.date}, 'YYYY-MM-DD')`,
      clicks: urlAnalyticsDaily.clicks,
    })
    .from(urlAnalyticsDaily)
    .where(eq(urlAnalyticsDaily.shortCode, code))
    .orderBy(urlAnalyticsDaily.date);

  // 3. Browser breakdown
  const browserResults = await db
    .select({
      name: sql<string>`coalesce(${urlClicks.browser}, 'Unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(urlClicks)
    .where(eq(urlClicks.shortCode, code))
    .groupBy(urlClicks.browser)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // 4. OS breakdown
  const osResults = await db
    .select({
      name: sql<string>`coalesce(${urlClicks.os}, 'Unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(urlClicks)
    .where(eq(urlClicks.shortCode, code))
    .groupBy(urlClicks.os)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // 5. Device breakdown
  const deviceResults = await db
    .select({
      name: sql<string>`coalesce(${urlClicks.device}, 'Desktop')`,
      count: sql<number>`count(*)::int`,
    })
    .from(urlClicks)
    .where(eq(urlClicks.shortCode, code))
    .groupBy(urlClicks.device)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // 6. Recent 20 clicks
  const recentClicks = await db
    .select({
      clicked_at: sql<string>`${urlClicks.clickedAt}::text`,
      browser: urlClicks.browser,
      os: urlClicks.os,
      device: urlClicks.device,
      ip_address: urlClicks.ipAddress,
      referer: urlClicks.referer,
    })
    .from(urlClicks)
    .where(eq(urlClicks.shortCode, code))
    .orderBy(desc(urlClicks.clickedAt))
    .limit(20);

  return reply.send({
    short_code: code,
    original_url: urlRecord.originalUrl,
    created_at: urlRecord.createdAt.toISOString(),
    expires_at: urlRecord.expiresAt ? urlRecord.expiresAt.toISOString() : null,
    total_clicks: totalResult?.total ?? 0,
    daily_clicks: dailyResults,
    browsers: browserResults,
    os: osResults,
    devices: deviceResults,
    recent_clicks: recentClicks,
  });
});

// Redirection Endpoint
app.get('/:code', async (request, reply) => {
  const { code } = request.params as { code: string };

  // Avoid handling API routes or favicon
  if (code.startsWith('api') || code === 'favicon.ico' || code === 'health') {
    return reply.status(404).send({ error: 'Not found' });
  }

  const clientIp =
    (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    request.ip;
  const userAgent = request.headers['user-agent'] || '';
  const referer = request.headers['referer'] || '';

  // 1. Check Redis Cache
  const cached = await getUrlFromCache(code);

  if (cached === REDIS_KEYS.NOT_FOUND_SENTINEL) {
    // Cache penetration hit: non-existent key was cached
    return reply.status(404).send({ error: 'Short URL not found (cached)' });
  }

  let targetUrl: string | null = cached;

  if (!targetUrl) {
    // 2. Cache Miss: Query PostgreSQL
    const db = getDb();
    const [record] = await db
      .select()
      .from(urls)
      .where(eq(urls.shortCode, code))
      .limit(1);

    if (!record) {
      // Set negative cache for 60 seconds (ADR-0003)
      await setNegativeCache(code, 60);
      return reply.status(404).send({ error: 'Short URL not found' });
    }

    // Check expiration
    if (record.expiresAt && new Date() > record.expiresAt) {
      return reply.status(410).send({ error: 'Short URL has expired' });
    }

    targetUrl = record.originalUrl;
    // Cache in Redis for 24h
    await setUrlInCache(code, targetUrl, 86400);
  }

  // 3. Emit Click Event asynchronously to Kafka
  publishClickEvent({
    shortCode: code,
    ipAddress: clientIp,
    userAgent,
    referer,
    timestamp: new Date().toISOString(),
  }).catch((err) => {
    app.log.error(err, 'Async Kafka publish failed');
  });

  // 4. Return HTTP 302 with Edge CDN Cache header (ADR-0002)
  return reply
    .status(302)
    .header('Location', targetUrl)
    .header('Cache-Control', 'public, s-maxage=30')
    .header('X-Server-Instance', INSTANCE_NAME)
    .send();
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[URL-Service] Server (${INSTANCE_NAME}) listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
