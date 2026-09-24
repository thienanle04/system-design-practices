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
  setDeactivatedCache,
  deleteUrlFromCache,
  REDIS_KEYS,
  REDIS_CHANNELS,
  publishClickEvent,
  publishLiveClick,
  createRedisSubscriber,
  getRedisClient,
  getAvailableKeysCountFromRedis,
  recordNodeHeartbeat,
  getActiveNodes,
  getHealthSnapshot,
  setHealthSnapshot,
  checkKafkaHealth,
  eq,
  sql,
  desc,
  and,
  or,
  ilike,
  SystemHealthSnapshot,
  LiveClickPayload,
  HealthStatus,
} from '@tiny-url/shared';


const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'api-instance';

export const RESERVED_SHORT_CODES = new Set([
  'dashboard',
  'admin',
  'api',
  'health',
  'metrics',
  'static',
  'assets',
  'favicon.ico',
  'r',
  'docs',
]);

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

// Lightweight User-Agent parser for instant SSE broadcast
function parseUserAgentLight(ua: string) {
  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('curl/')) browser = 'cURL';

  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let device = 'Desktop';
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';

  return { browser, os, device };
}

// Collector for System Health Snapshot (ADR-0006)
async function collectSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const now = new Date();

  // 1. PostgreSQL check
  let postgresStatus: 'UP' | 'DOWN' = 'DOWN';
  let postgresLatency = 0;
  let postgresError: string | undefined;
  try {
    const start = performance.now();
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    postgresLatency = Math.round(performance.now() - start);
    postgresStatus = 'UP';
  } catch (err: any) {
    postgresError = err.message;
  }

  // 2. Redis check
  let redisStatus: 'UP' | 'DOWN' = 'DOWN';
  let redisLatency = 0;
  let redisError: string | undefined;
  let keyBufferDepth = 0;
  try {
    const start = performance.now();
    const redis = getRedisClient();
    await redis.ping();
    redisLatency = Math.round(performance.now() - start);
    redisStatus = 'UP';
    keyBufferDepth = await getAvailableKeysCountFromRedis();
  } catch (err: any) {
    redisError = err.message;
  }

  // 3. Kafka check
  const kafkaHealth = await checkKafkaHealth();

  // 4. Active Service Nodes
  const nodes = await getActiveNodes();

  // 5. KGS Status
  let kgsStatus: 'HEALTHY' | 'LOW_BUFFER' | 'CRITICAL' = 'HEALTHY';
  if (keyBufferDepth < 500) {
    kgsStatus = 'CRITICAL';
  } else if (keyBufferDepth < 1000) {
    kgsStatus = 'LOW_BUFFER';
  }

  // 6. Overall System Health Status
  let overallStatus: HealthStatus = 'Operational';
  let summary = 'All platform components are healthy';

  if (postgresStatus === 'DOWN' || redisStatus === 'DOWN') {
    overallStatus = 'Outage';
    summary = 'Critical: Primary database or Redis cache is unreachable';
  } else if (
    kafkaHealth.status === 'DOWN' ||
    kgsStatus !== 'HEALTHY' ||
    nodes.length < 2
  ) {
    overallStatus = 'Degraded';
    const issues: string[] = [];
    if (kafkaHealth.status === 'DOWN') issues.push('Kafka broker connection degraded');
    if (kgsStatus !== 'HEALTHY') issues.push(`KGS Key Buffer low (${keyBufferDepth} keys remaining)`);
    if (nodes.length < 2) issues.push(`Partial API cluster (${nodes.length}/2 active nodes detected)`);
    summary = issues.join(' • ');
  }

  return {
    status: overallStatus,
    timestamp: now.toISOString(),
    summary,
    dependencies: {
      postgres: {
        status: postgresStatus,
        latency_ms: postgresLatency,
        error: postgresError,
      },
      redis: {
        status: redisStatus,
        latency_ms: redisLatency,
        error: redisError,
      },
      kafka: {
        status: kafkaHealth.status,
        error: kafkaHealth.error,
      },
    },
    kgs: {
      key_buffer_depth: keyBufferDepth,
      status: kgsStatus,
    },
    nodes,
  };
}

// System Status Endpoint (ADR-0006)
app.get('/api/v1/system/status', async (request, reply) => {
  try {
    let snapshot = await getHealthSnapshot();
    if (!snapshot) {
      snapshot = await collectSystemHealthSnapshot();
      await setHealthSnapshot(snapshot, 10);
    }
    return reply.send(snapshot);
  } catch (err: any) {
    return reply.status(500).send({
      status: 'Outage',
      timestamp: new Date().toISOString(),
      summary: 'Failed to retrieve system health snapshot',
      error: err.message,
    });
  }
});

// SSE Live Events Stream (ADR-0006)
app.get('/api/v1/events/live', async (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  reply.raw.flushHeaders();

  // Initial connection message
  reply.raw.write(
    `data: ${JSON.stringify({
      type: 'connected',
      instance: INSTANCE_NAME,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const subscriber = createRedisSubscriber();
  await subscriber.subscribe(REDIS_CHANNELS.LIVE_CLICKS);

  const messageHandler = (channel: string, message: string) => {
    if (channel === REDIS_CHANNELS.LIVE_CLICKS) {
      reply.raw.write(`data: ${message}\n\n`);
    }
  };

  subscriber.on('message', messageHandler);

  // Keep-alive heartbeat comment every 15s to prevent proxy timeouts
  const keepAliveTimer = setInterval(() => {
    try {
      reply.raw.write(`: keepalive\n\n`);
    } catch {
      // ignore write error if socket closed
    }
  }, 15000);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(keepAliveTimer);
    subscriber.off('message', messageHandler);
    subscriber.unsubscribe(REDIS_CHANNELS.LIVE_CLICKS).catch(() => {});
    subscriber.quit().catch(() => {});
  };

  request.raw.on('close', cleanup);
  request.raw.on('end', cleanup);
  reply.raw.on('close', cleanup);

  // Keep connection open until client closes
  await new Promise<void>((resolve) => {
    request.raw.on('close', resolve);
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
    const normalized = custom_alias.trim().toLowerCase();
    if (RESERVED_SHORT_CODES.has(normalized)) {
      return reply.status(400).send({
        error: 'This alias is forbidden',
      });
    }

    isCustom = true;
    shortCode = custom_alias.trim();

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

// List Short URLs with Pagination, Search & Filter
const listUrlsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'expired', 'deactivated']).default('all'),
});

app.get('/api/v1/urls', async (request, reply) => {
  const parseResult = listUrlsQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { page, limit, search, status } = parseResult.data;
  const offset = (page - 1) * limit;
  const db = getDb();

  const conditions = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(ilike(urls.shortCode, term), ilike(urls.originalUrl, term)));
  }

  if (status === 'active') {
    conditions.push(
      and(
        eq(urls.isActive, true),
        or(sql`${urls.expiresAt} IS NULL`, sql`${urls.expiresAt} > NOW()`)
      )
    );
  } else if (status === 'expired') {
    conditions.push(
      and(
        eq(urls.isActive, true),
        sql`${urls.expiresAt} IS NOT NULL`,
        sql`${urls.expiresAt} <= NOW()`
      )
    );
  } else if (status === 'deactivated') {
    conditions.push(eq(urls.isActive, false));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(urls)
    .where(whereClause);

  const total = countRes?.count ?? 0;

  const rows = await db
    .select({
      id: urls.id,
      short_code: urls.shortCode,
      original_url: urls.originalUrl,
      is_custom: urls.isCustom,
      is_active: urls.isActive,
      expires_at: urls.expiresAt,
      created_at: urls.createdAt,
      total_clicks: sql<number>`coalesce(count(${urlClicks.id}), 0)::int`,
    })
    .from(urls)
    .leftJoin(urlClicks, eq(urls.shortCode, urlClicks.shortCode))
    .where(whereClause)
    .groupBy(urls.id)
    .orderBy(desc(urls.createdAt))
    .limit(limit)
    .offset(offset);

  const now = new Date();
  const data = rows.map((r) => {
    const isExpired = r.expires_at ? new Date(r.expires_at) <= now : false;
    let computedStatus: 'active' | 'expired' | 'deactivated' = 'active';
    if (!r.is_active) {
      computedStatus = 'deactivated';
    } else if (isExpired) {
      computedStatus = 'expired';
    }

    return {
      id: r.id,
      short_code: r.short_code,
      short_url: `${BASE_URL}/${r.short_code}`,
      original_url: r.original_url,
      is_custom: r.is_custom,
      is_active: r.is_active,
      status: computedStatus,
      expires_at: r.expires_at ? r.expires_at.toISOString() : null,
      created_at: r.created_at.toISOString(),
      total_clicks: r.total_clicks,
    };
  });

  return reply.send({
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  });
});

// Update Short URL (Soft Deactivate/Reactivate & Expiration)
const updateUrlSchema = z.object({
  is_active: z.boolean().optional(),
  expires_at: z.string().nullable().optional(),
});

app.patch('/api/v1/urls/:code', async (request, reply) => {
  const { code } = request.params as { code: string };
  const parseResult = updateUrlSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!existing) {
    return reply.status(404).send({ error: 'Short URL not found' });
  }

  const { is_active, expires_at } = parseResult.data;
  const updateData: any = {};

  if (is_active !== undefined) {
    updateData.isActive = is_active;
  }

  if (expires_at !== undefined) {
    updateData.expiresAt = expires_at ? new Date(expires_at) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return reply.status(400).send({ error: 'No fields to update provided' });
  }

  const [updated] = await db
    .update(urls)
    .set(updateData)
    .where(eq(urls.shortCode, code))
    .returning();

  // Cache synchronization
  if (updated.isActive === false) {
    await deleteUrlFromCache(code);
    await setDeactivatedCache(code, 60);
  } else {
    // If active, check if expired
    if (updated.expiresAt && new Date() > updated.expiresAt) {
      await deleteUrlFromCache(code);
      await setDeactivatedCache(code, 60);
    } else {
      let ttlSeconds = 86400;
      if (updated.expiresAt) {
        const remaining = Math.floor((updated.expiresAt.getTime() - Date.now()) / 1000);
        ttlSeconds = Math.max(1, Math.min(86400, remaining));
      }
      await setUrlInCache(code, updated.originalUrl, ttlSeconds);
    }
  }

  const isExpired = updated.expiresAt ? new Date(updated.expiresAt) <= new Date() : false;
  let computedStatus: 'active' | 'expired' | 'deactivated' = 'active';
  if (!updated.isActive) {
    computedStatus = 'deactivated';
  } else if (isExpired) {
    computedStatus = 'expired';
  }

  return reply.send({
    id: updated.id,
    short_code: updated.shortCode,
    short_url: `${BASE_URL}/${updated.shortCode}`,
    original_url: updated.originalUrl,
    is_custom: updated.isCustom,
    is_active: updated.isActive,
    status: computedStatus,
    expires_at: updated.expiresAt ? updated.expiresAt.toISOString() : null,
    created_at: updated.createdAt.toISOString(),
  });
});

// Soft Delete (Deactivate) Short URL
app.delete('/api/v1/urls/:code', async (request, reply) => {
  const { code } = request.params as { code: string };
  const db = getDb();

  const [existing] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!existing) {
    return reply.status(404).send({ error: 'Short URL not found' });
  }

  await db
    .update(urls)
    .set({ isActive: false })
    .where(eq(urls.shortCode, code));

  await deleteUrlFromCache(code);
  await setDeactivatedCache(code, 60);

  return reply.send({
    message: 'Short URL deactivated successfully',
    short_code: code,
  });
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

  // Avoid handling API routes, reserved codes, or static files
  if (code.startsWith('api') || RESERVED_SHORT_CODES.has(code.toLowerCase())) {
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

  if (cached === REDIS_KEYS.DEACTIVATED_SENTINEL) {
    // Negative cache hit: deactivated/expired link was cached
    return reply.status(410).send({ error: 'Short URL has been deactivated or expired (cached)' });
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

    // Check soft deactivation (ADR-0005)
    if (!record.isActive) {
      await setDeactivatedCache(code, 60);
      return reply.status(410).send({ error: 'Short URL has been deactivated' });
    }

    // Check expiration
    if (record.expiresAt && new Date() > record.expiresAt) {
      await setDeactivatedCache(code, 60);
      return reply.status(410).send({ error: 'Short URL has expired' });
    }

    targetUrl = record.originalUrl;
    // Cache in Redis for 24h
    await setUrlInCache(code, targetUrl, 86400);
  }

  const nowIso = new Date().toISOString();

  // 3. Emit Click Event asynchronously to Kafka
  publishClickEvent({
    shortCode: code,
    ipAddress: clientIp,
    userAgent,
    referer,
    timestamp: nowIso,
  }).catch((err) => {
    app.log.error(err, 'Async Kafka publish failed');
  });

  // Fan-out to Redis Pub/Sub for Live Dashboard (ADR-0006)
  const { browser, os, device } = parseUserAgentLight(userAgent);
  publishLiveClick({
    short_code: code,
    original_url: targetUrl,
    ip_address: clientIp,
    device,
    browser,
    os,
    referer: referer || undefined,
    timestamp: nowIso,
  }).catch((err) => {
    app.log.error(err, 'Async Redis live click publish failed');
  });

  // 4. Return HTTP 302 with Edge CDN Cache header (ADR-0002)
  return reply
    .status(302)
    .header('Location', targetUrl)
    .header('Cache-Control', 'public, s-maxage=30')
    .header('X-Server-Instance', INSTANCE_NAME)
    .send();
});

// Observability background loop (ADR-0006)
const startObservabilityLoops = () => {
  // Record initial heartbeat
  recordNodeHeartbeat(INSTANCE_NAME).catch((err) => {
    app.log.error(err, 'Failed to record initial heartbeat');
  });

  // Pulse heartbeat and update health snapshot every 5 seconds
  setInterval(async () => {
    try {
      await recordNodeHeartbeat(INSTANCE_NAME);
      const snapshot = await collectSystemHealthSnapshot();
      await setHealthSnapshot(snapshot, 10);
    } catch (err) {
      app.log.error(err, 'Error in health probe loop');
    }
  }, 5000);
};

// Start server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[URL-Service] Server (${INSTANCE_NAME}) listening on http://${HOST}:${PORT}`);
    startObservabilityLoops();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

