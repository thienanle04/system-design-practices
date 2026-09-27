import {
  getDb,
  getDbPool,
  kgsKeys,
  pushAvailableKeysToRedis,
  getAvailableKeysCountFromRedis,
  getRedisClient,
  generateKeysBatch,
  DEFAULT_KEY_LENGTH,
  RESERVED_SHORT_CODES,
  eq,
  sql,
} from '@tiny-url/shared';

const MIN_DB_AVAILABLE_KEYS = 20000;
const SEED_BATCH_SIZE = 20000;
const MIN_REDIS_KEYS = 5000;
const ALLOCATE_BATCH_SIZE = 10000;
const POLL_INTERVAL_MS = 2000;

let isRunning = true;

async function ensureDbKeysPool(): Promise<void> {
  const db = getDb();

  // Count how many keys are currently AVAILABLE in DB
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kgsKeys)
    .where(eq(kgsKeys.status, 'AVAILABLE'));

  const availableCount = countResult?.count ?? 0;
  console.log(`[KGS] Current available keys in DB: ${availableCount}`);

  if (availableCount < MIN_DB_AVAILABLE_KEYS) {
    const keysToGenerate = SEED_BATCH_SIZE;
    console.log(`[KGS] Seeding ${keysToGenerate} new keys to DB (excluding reserved codes)...`);
    // Filter out reserved short codes like 'metrics'
    const newKeys = generateKeysBatch(keysToGenerate, DEFAULT_KEY_LENGTH, RESERVED_SHORT_CODES);

    // Insert in chunks of 2000
    const chunkSize = 2000;
    const pool = getDbPool();
    for (let i = 0; i < newKeys.length; i += chunkSize) {
      if (!isRunning) break;
      const chunk = newKeys.slice(i, i + chunkSize);
      const valuesStr = chunk.map((k) => `('${k}', 'AVAILABLE')`).join(',');
      await pool.query(`
        INSERT INTO kgs_keys (key, status)
        VALUES ${valuesStr}
        ON CONFLICT (key) DO NOTHING;
      `);
    }
    console.log(`[KGS] Successfully seeded ${keysToGenerate} keys into DB.`);
  }
}

async function replenishRedisQueue(): Promise<void> {
  const currentRedisCount = await getAvailableKeysCountFromRedis();
  console.log(`[KGS] Current available keys in Redis list: ${currentRedisCount}`);

  if (currentRedisCount < MIN_REDIS_KEYS) {
    console.log(`[KGS] Redis key count low (< ${MIN_REDIS_KEYS}). Claiming batch from DB...`);
    const pool = getDbPool();

    // Atomically claim keys using FOR UPDATE SKIP LOCKED
    const result = await pool.query<{ key: string }>(`
      UPDATE kgs_keys
      SET status = 'ALLOCATED'
      WHERE id IN (
        SELECT id FROM kgs_keys
        WHERE status = 'AVAILABLE'
        ORDER BY id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING key;
    `, [ALLOCATE_BATCH_SIZE]);

    const claimedKeys = result.rows.map((r) => r.key);
    if (claimedKeys.length > 0) {
      const newTotal = await pushAvailableKeysToRedis(claimedKeys);
      console.log(`[KGS] Allocated and pushed ${claimedKeys.length} keys to Redis. New list length: ${newTotal}`);
    } else {
      console.warn('[KGS] No AVAILABLE keys found in DB to allocate! Triggering seed...');
      await ensureDbKeysPool();
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[KGS] Key Generation Service starting up...');

  const shutdown = async (signal: string) => {
    console.log(`[KGS] Received ${signal}. Shutting down gracefully...`);
    isRunning = false;
    try {
      const redis = getRedisClient();
      await redis.quit();
      const pool = getDbPool();
      await pool.end();
      console.log('[KGS] Graceful shutdown completed.');
      process.exit(0);
    } catch (err) {
      console.error('[KGS] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Wait a moment for DB and Redis to settle on initial container boot
  await sleep(3000);

  while (isRunning) {
    try {
      await ensureDbKeysPool();
      await replenishRedisQueue();
    } catch (err) {
      console.error('[KGS] Error in replenishment cycle:', err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error('[KGS] Fatal error:', err);
  process.exit(1);
});
