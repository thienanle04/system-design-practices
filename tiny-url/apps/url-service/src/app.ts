import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  getDb,
  urls,
  urlClicks,
  urlAnalyticsDaily,
  apiKeys,
  getAvailableKeyFromRedis,
  getUrlFromCache,
  setUrlInCache,
  setNegativeCache,
  setDeactivatedCache,
  deleteUrlFromCache,
  getApiKeyFromCache,
  setApiKeyInCache,
  checkRateLimitAndQuota,
  RATE_LIMIT_TIERS,
  REDIS_KEYS,
  REDIS_CHANNELS,
  publishClickEvent,
  publishLiveClick,
  createRedisSubscriber,
  getRedisClient,
  getAvailableKeysCountFromRedis,
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
  HealthStatus,
  AccountTier,
  ApiKeyRecord,
  createUrlSchema,
  listUrlsQuerySchema,
  updateUrlSchema,
  parseUserAgentLight,
  isReservedShortCode,
  RESERVED_SHORT_CODES,
} from '@tiny-url/shared';

export interface BuildAppOptions {
  logger?: boolean | object;
  instanceName?: string;
  baseUrl?: string;
}

export function getClientIp(request: any): string {
  const xRealIp = request.headers['x-real-ip'];
  if (xRealIp && typeof xRealIp === 'string') {
    return xRealIp.trim();
  }
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (xForwardedFor && typeof xForwardedFor === 'string') {
    const parts = xForwardedFor.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return request.ip || '127.0.0.1';
}

// Collector for System Health Snapshot (ADR-0006)
export async function collectSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
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

// Resolve Client Identity and Account Tier from X-API-Key or IP
export async function resolveRequestTier(request: any): Promise<{
  tier: AccountTier;
  identifier: string;
  apiKeyRecord?: ApiKeyRecord;
  error?: { status: number; message: string };
}> {
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

  // Unauthenticated / Guest tier identified by Client IP
  if (!apiKeyHeader || !apiKeyHeader.trim()) {
    const clientIp = getClientIp(request);
    return {
      tier: 'guest',
      identifier: clientIp,
    };
  }

  const rawKey = apiKeyHeader.trim();
  const cached = await getApiKeyFromCache(rawKey);

  if (cached === '__NOT_FOUND__') {
    return {
      tier: 'guest',
      identifier: 'invalid',
      error: { status: 401, message: 'Invalid or inactive API key' },
    };
  }

  if (cached && typeof cached === 'object') {
    if (!cached.isActive) {
      return {
        tier: 'guest',
        identifier: 'inactive',
        error: { status: 403, message: 'API key is deactivated' },
      };
    }
    return {
      tier: cached.tier,
      identifier: `key_${cached.id}`,
      apiKeyRecord: cached,
    };
  }

  // Cache miss -> Query DB
  const db = getDb();
  const [record] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, rawKey))
    .limit(1);

  if (!record) {
    await setApiKeyInCache(rawKey, null);
    return {
      tier: 'guest',
      identifier: 'invalid',
      error: { status: 401, message: 'Invalid or inactive API key' },
    };
  }

  const apiKeyRecord: ApiKeyRecord = {
    id: Number(record.id),
    key: record.key,
    name: record.name,
    tier: record.tier as AccountTier,
    isActive: record.isActive,
    createdAt: record.createdAt,
  };

  await setApiKeyInCache(rawKey, apiKeyRecord, 3600);

  if (!apiKeyRecord.isActive) {
    return {
      tier: 'guest',
      identifier: 'inactive',
      error: { status: 403, message: 'API key is deactivated' },
    };
  }

  return {
    tier: apiKeyRecord.tier,
    identifier: `key_${apiKeyRecord.id}`,
    apiKeyRecord,
  };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const instanceName = options.instanceName || process.env.INSTANCE_NAME || 'api-instance';
  const baseUrl = options.baseUrl || process.env.BASE_URL || 'http://localhost:8080';

  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL || 'info',
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      instance: instanceName,
      timestamp: new Date().toISOString(),
    });
  });

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

    reply.raw.write(
      `data: ${JSON.stringify({
        type: 'connected',
        instance: instanceName,
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

    await new Promise<void>((resolve) => {
      request.raw.on('close', resolve);
    });
  });

  // Create Short URL
  app.post('/api/v1/urls', async (request, reply) => {
    // 1. Resolve Account Tier & Identity (ADR-0010)
    const clientInfo = await resolveRequestTier(request);
    if (clientInfo.error) {
      return reply.status(clientInfo.error.status).send({
        error: clientInfo.error.message,
      });
    }

    // 2. Enforce Tier-Based Rate Limiting & Daily Quota (ADR-0010)
    const rateCheck = await checkRateLimitAndQuota(clientInfo.identifier, clientInfo.tier);
    reply.header('RateLimit-Limit', rateCheck.limitRate);
    reply.header('RateLimit-Remaining', rateCheck.remainingRate);
    reply.header('RateLimit-Reset', rateCheck.resetRateSeconds);
    reply.header('X-Daily-Quota-Limit', rateCheck.limitQuota);
    reply.header('X-Daily-Quota-Remaining', rateCheck.remainingQuota);

    if (!rateCheck.allowed) {
      reply.header('Retry-After', rateCheck.retryAfterSeconds);
      return reply.status(429).send({
        error:
          rateCheck.reason === 'quota'
            ? `Daily URL creation quota reached (${rateCheck.limitQuota} links/day) for ${clientInfo.tier} tier.`
            : `Creation rate limit exceeded (${rateCheck.limitRate} requests/min) for ${clientInfo.tier} tier.`,
        tier: clientInfo.tier,
        reason: rateCheck.reason,
        retry_after_seconds: rateCheck.retryAfterSeconds,
      });
    }

    const parseResult = createUrlSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { original_url, custom_alias, expires_in_days } = parseResult.data;
    const db = getDb();

    let shortCode = '';
    let isCustom = false;

    if (custom_alias) {
      if (isReservedShortCode(custom_alias)) {
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
    }

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    const maxAttempts = isCustom ? 1 : 3;
    let inserted: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!isCustom) {
        const key = await getAvailableKeyFromRedis();
        if (!key) {
          reply.header('Retry-After', 1);
          return reply.status(503).send({
            error: 'Key buffer depleted. Pre-generated keys temporarily exhausted under high write burst. Please retry shortly.',
            system_status: 'Degraded',
          });
        }
        shortCode = key;
      }

      try {
        const [res] = await db
          .insert(urls)
          .values({
            shortCode,
            originalUrl: original_url,
            isCustom,
            expiresAt,
          })
          .returning();
        inserted = res;
        break;
      } catch (err: any) {
        if (err.code === '23505') {
          if (isCustom || attempt === maxAttempts - 1) {
            return reply.status(409).send({
              error: isCustom ? 'Custom alias is already taken. Please choose another.' : 'Short code already exists. Please retry.',
            });
          }
          continue;
        }
        app.log.error(err, 'Failed to create URL');
        return reply.status(500).send({
          error: 'Internal server error',
        });
      }
    }

    // Warm Redis cache (TTL in seconds: 24 hours or until link expiration)
    let ttlSeconds = 86400;
    if (expiresAt) {
      const remainingSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      ttlSeconds = Math.max(1, Math.min(86400, remainingSeconds));
    }

    await setUrlInCache(shortCode, original_url, ttlSeconds);

    return reply.status(201).send({
      short_code: inserted.shortCode,
      short_url: `${baseUrl}/${inserted.shortCode}`,
      original_url: inserted.originalUrl,
      is_custom: inserted.isCustom,
      expires_at: inserted.expiresAt ? inserted.expiresAt.toISOString() : null,
      created_at: inserted.createdAt.toISOString(),
      served_by: instanceName,
      tier: clientInfo.tier,
    });
  });

  // List Short URLs with Pagination, Search & Filter
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
        short_url: `${baseUrl}/${r.short_code}`,
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
      short_url: `${baseUrl}/${updated.shortCode}`,
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

    if (code.startsWith('api') || isReservedShortCode(code)) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const clientIp = getClientIp(request);
    const userAgent = (request.headers['user-agent'] as string) || '';
    const referer = (request.headers['referer'] as string) || '';

    // 1. Check Redis Cache
    const cached = await getUrlFromCache(code);

    if (cached === REDIS_KEYS.NOT_FOUND_SENTINEL) {
      return reply.status(404).send({ error: 'Short URL not found (cached)' });
    }

    if (cached === REDIS_KEYS.DEACTIVATED_SENTINEL) {
      return reply.status(410).send({ error: 'Short URL has been deactivated or expired (cached)' });
    }

    let targetUrl: string | null = cached;

    if (!targetUrl) {
      const db = getDb();
      const [record] = await db
        .select()
        .from(urls)
        .where(eq(urls.shortCode, code))
        .limit(1);

      if (!record) {
        await setNegativeCache(code, 60);
        return reply.status(404).send({ error: 'Short URL not found' });
      }

      if (!record.isActive) {
        await setDeactivatedCache(code, 60);
        return reply.status(410).send({ error: 'Short URL has been deactivated' });
      }

      if (record.expiresAt && new Date() > record.expiresAt) {
        await setDeactivatedCache(code, 60);
        return reply.status(410).send({ error: 'Short URL has expired' });
      }

      targetUrl = record.originalUrl;
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
      .header('X-Server-Instance', instanceName)
      .send();
  });

  return app;
}
