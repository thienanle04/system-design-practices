import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export const REDIS_KEYS = {
  AVAILABLE_KEYS_LIST: 'kgs:available_keys',
  URL_PREFIX: 'url:',
  NOT_FOUND_SENTINEL: '__NOT_FOUND__',
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

export async function deleteUrlFromCache(shortCode: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${REDIS_KEYS.URL_PREFIX}${shortCode}`);
}
