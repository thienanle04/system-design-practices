import { Redis } from 'ioredis';

import type { LiveClickPayload, SystemHealthSnapshot, ServiceNodeInfo } from '../types/index.js';

let redisClient: Redis | null = null;

export const REDIS_KEYS = {
  AVAILABLE_KEYS_LIST: 'kgs:available_keys',
  URL_PREFIX: 'url:',
  NOT_FOUND_SENTINEL: '__NOT_FOUND__',
  DEACTIVATED_SENTINEL: '__DEACTIVATED__',
  HEALTH_SNAPSHOT: 'system:health:snapshot',
  NODE_HEARTBEAT_PREFIX: 'system:node:',
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

