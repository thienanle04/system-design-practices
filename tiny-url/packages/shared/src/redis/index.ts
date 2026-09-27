import { Redis } from 'ioredis';

import type { LiveClickPayload, SystemHealthSnapshot, ServiceNodeInfo, AccountTier, RateLimitResult, ApiKeyRecord } from '../types/index.js';

let redisClient: Redis | null = null;

export const RATE_LIMIT_TIERS: Record<AccountTier, { rateLimitPerMinute: number; dailyQuota: number }> = {
  guest: {
    rateLimitPerMinute: 5,
    dailyQuota: 20,
  },
  free: {
    rateLimitPerMinute: 30,
    dailyQuota: 500,
  },
  paid: {
    rateLimitPerMinute: 300,
    dailyQuota: 50000,
  },
};

export const REDIS_KEYS = {
  AVAILABLE_KEYS_LIST: 'kgs:available_keys',
  URL_PREFIX: 'url:',
  NOT_FOUND_SENTINEL: '__NOT_FOUND__',
  DEACTIVATED_SENTINEL: '__DEACTIVATED__',
  HEALTH_SNAPSHOT: 'system:health:snapshot',
  NODE_HEARTBEAT_PREFIX: 'system:node:',
  API_KEY_PREFIX: 'auth:api_key:',
  RATE_LIMIT_PREFIX: 'ratelimit:',
  QUOTA_PREFIX: 'quota:',
};

export const REDIS_CHANNELS = {
  LIVE_CLICKS: 'channel:live_clicks',
};


export function getRedisClient(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    redisClient = new Redis({
      host,
      port,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 100, 2000);
      },
    });
  }
  return redisClient;
}

export async function getAvailableKeyFromRedis(): Promise<string | null> {
  const redis = getRedisClient();
  return await redis.lpop(REDIS_KEYS.AVAILABLE_KEYS_LIST);
}

export async function pushAvailableKeysToRedis(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const redis = getRedisClient();
  return await redis.rpush(REDIS_KEYS.AVAILABLE_KEYS_LIST, ...keys);
}

export async function getAvailableKeysCountFromRedis(): Promise<number> {
  const redis = getRedisClient();
  return await redis.llen(REDIS_KEYS.AVAILABLE_KEYS_LIST);
}

export async function getUrlFromCache(shortCode: string): Promise<string | null> {
  const redis = getRedisClient();
  return await redis.get(`${REDIS_KEYS.URL_PREFIX}${shortCode}`);
}

export async function setUrlInCache(shortCode: string, originalUrl: string, ttlSeconds: number = 86400): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`${REDIS_KEYS.URL_PREFIX}${shortCode}`, ttlSeconds, originalUrl);
}

export async function setNegativeCache(shortCode: string, ttlSeconds: number = 60): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`${REDIS_KEYS.URL_PREFIX}${shortCode}`, ttlSeconds, REDIS_KEYS.NOT_FOUND_SENTINEL);
}

export async function setDeactivatedCache(shortCode: string, ttlSeconds: number = 60): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`${REDIS_KEYS.URL_PREFIX}${shortCode}`, ttlSeconds, REDIS_KEYS.DEACTIVATED_SENTINEL);
}

export async function deleteUrlFromCache(shortCode: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${REDIS_KEYS.URL_PREFIX}${shortCode}`);
}

export function createRedisSubscriber(): Redis {
  const client = getRedisClient();
  return client.duplicate();
}

export async function publishLiveClick(event: LiveClickPayload): Promise<number> {
  const redis = getRedisClient();
  return await redis.publish(REDIS_CHANNELS.LIVE_CLICKS, JSON.stringify(event));
}

export async function setHealthSnapshot(
  snapshot: SystemHealthSnapshot,
  ttlSeconds: number = 10
): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(REDIS_KEYS.HEALTH_SNAPSHOT, ttlSeconds, JSON.stringify(snapshot));
}

export async function getHealthSnapshot(): Promise<SystemHealthSnapshot | null> {
  const redis = getRedisClient();
  const raw = await redis.get(REDIS_KEYS.HEALTH_SNAPSHOT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SystemHealthSnapshot;
  } catch {
    return null;
  }
}

export async function recordNodeHeartbeat(
  instanceName: string,
  ttlSeconds: number = 10
): Promise<void> {
  const redis = getRedisClient();
  const payload = {
    instance: instanceName,
    last_heartbeat: new Date().toISOString(),
    timestamp: Date.now(),
  };
  await redis.setex(
    `${REDIS_KEYS.NODE_HEARTBEAT_PREFIX}${instanceName}`,
    ttlSeconds,
    JSON.stringify(payload)
  );
}

export async function getActiveNodes(): Promise<ServiceNodeInfo[]> {
  const redis = getRedisClient();
  const keys = await redis.keys(`${REDIS_KEYS.NODE_HEARTBEAT_PREFIX}*`);
  if (!keys || keys.length === 0) return [];

  const now = Date.now();
  const nodes: ServiceNodeInfo[] = [];

  for (const k of keys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const ageSec = Math.max(0, Math.round((now - data.timestamp) / 1000));
      nodes.push({
        instance: data.instance,
        status: ageSec <= 10 ? 'ALIVE' : 'OFFLINE',
        last_heartbeat: data.last_heartbeat,
        age_seconds: ageSec,
      });
    } catch {
      // skip corrupted data
    }
  }

  return nodes.sort((a, b) => a.instance.localeCompare(b.instance));
}

export async function getApiKeyFromCache(apiKey: string): Promise<ApiKeyRecord | null | '__NOT_FOUND__'> {
  const redis = getRedisClient();
  const raw = await redis.get(`${REDIS_KEYS.API_KEY_PREFIX}${apiKey}`);
  if (!raw) return null;
  if (raw === REDIS_KEYS.NOT_FOUND_SENTINEL) return '__NOT_FOUND__';
  try {
    return JSON.parse(raw) as ApiKeyRecord;
  } catch {
    return null;
  }
}

export async function setApiKeyInCache(
  apiKey: string,
  record: ApiKeyRecord | null,
  ttlSeconds: number = 3600
): Promise<void> {
  const redis = getRedisClient();
  if (!record) {
    await redis.setex(`${REDIS_KEYS.API_KEY_PREFIX}${apiKey}`, 60, REDIS_KEYS.NOT_FOUND_SENTINEL);
  } else {
    await redis.setex(`${REDIS_KEYS.API_KEY_PREFIX}${apiKey}`, ttlSeconds, JSON.stringify(record));
  }
}

const RATE_LIMIT_LUA = `
local rateKey = KEYS[1]
local quotaKey = KEYS[2]
local limitRate = tonumber(ARGV[1])
local limitQuota = tonumber(ARGV[2])
local rateExpire = tonumber(ARGV[3])
local quotaExpire = tonumber(ARGV[4])

local currentRate = tonumber(redis.call('get', rateKey) or '0')
if currentRate >= limitRate then
  local currentQuota = tonumber(redis.call('get', quotaKey) or '0')
  return { 0, 'rate_limit', currentRate + 1, currentQuota }
end

local currentQuota = tonumber(redis.call('get', quotaKey) or '0')
if currentQuota >= limitQuota then
  return { 0, 'quota', currentRate, currentQuota + 1 }
end

currentRate = redis.call('incr', rateKey)
if currentRate == 1 then
  redis.call('expire', rateKey, rateExpire)
end

currentQuota = redis.call('incr', quotaKey)
if currentQuota == 1 then
  redis.call('expire', quotaKey, quotaExpire)
end

return { 1, 'ok', currentRate, currentQuota }
`;

export async function checkRateLimitAndQuota(
  identifier: string,
  tier: AccountTier
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = new Date();
  const minuteSlot = Math.floor(now.getTime() / 60000);
  const resetRateSeconds = 60 - (Math.floor(now.getTime() / 1000) % 60);

  const daySlot = now.toISOString().slice(0, 10);
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const resetQuotaSeconds = Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));

  const rateKey = `${REDIS_KEYS.RATE_LIMIT_PREFIX}${tier}:${identifier}:${minuteSlot}`;
  const quotaKey = `${REDIS_KEYS.QUOTA_PREFIX}${tier}:${identifier}:${daySlot}`;

  const config = RATE_LIMIT_TIERS[tier];
  const limitRate = config.rateLimitPerMinute;
  const limitQuota = config.dailyQuota;

  const rawResult = (await redis.eval(
    RATE_LIMIT_LUA,
    2,
    rateKey,
    quotaKey,
    limitRate,
    limitQuota,
    65,
    resetQuotaSeconds + 60
  )) as [number, string, number, number];

  const [allowedFlag, reason, currentRate, currentQuota] = rawResult;
  const allowed = allowedFlag === 1;

  const remainingRate = Math.max(0, limitRate - currentRate);
  const remainingQuota = Math.max(0, limitQuota - currentQuota);

  if (!allowed) {
    const isQuota = reason === 'quota';
    return {
      allowed: false,
      reason: isQuota ? 'quota' : 'rate_limit',
      currentRate,
      limitRate,
      remainingRate: isQuota ? remainingRate : 0,
      resetRateSeconds,
      currentQuota,
      limitQuota,
      remainingQuota: isQuota ? 0 : remainingQuota,
      retryAfterSeconds: isQuota ? resetQuotaSeconds : resetRateSeconds,
    };
  }

  return {
    allowed: true,
    currentRate,
    limitRate,
    remainingRate,
    resetRateSeconds,
    currentQuota,
    limitQuota,
    remainingQuota,
    retryAfterSeconds: 0,
  };
}

