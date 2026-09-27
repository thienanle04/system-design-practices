import { buildApp, collectSystemHealthSnapshot } from './app.js';
import { recordNodeHeartbeat, setHealthSnapshot, getRedisClient, getDbPool } from '@tiny-url/shared';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'api-instance';

let healthProbeTimer: NodeJS.Timeout | null = null;

// Observability background loop (ADR-0006)
const startObservabilityLoops = (logger: any) => {
  // Record initial heartbeat
  recordNodeHeartbeat(INSTANCE_NAME).catch((err) => {
    logger.error(err, 'Failed to record initial heartbeat');
  });

  // Pulse heartbeat and update health snapshot every 5 seconds
  healthProbeTimer = setInterval(async () => {
    try {
      await recordNodeHeartbeat(INSTANCE_NAME);
      const snapshot = await collectSystemHealthSnapshot();
      await setHealthSnapshot(snapshot, 10);
    } catch (err) {
      logger.error(err, 'Error in health probe loop');
    }
  }, 5000);
};

// Start server
const start = async () => {
  const app = await buildApp({
    instanceName: INSTANCE_NAME,
    baseUrl: process.env.BASE_URL || 'http://localhost:8080',
  });

  // Graceful shutdown handler (Phase 3)
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.log.info(`[URL-Service] Received ${signal}. Initiating graceful shutdown...`);

    if (healthProbeTimer) {
      clearInterval(healthProbeTimer);
    }

    try {
      // 1. Close Fastify server (stops accepting new connections, drains in-flight requests)
      await app.close();
      app.log.info('[URL-Service] HTTP server closed.');

      // 2. Disconnect Redis client
      try {
        const redis = getRedisClient();
        await redis.quit();
        app.log.info('[URL-Service] Redis client disconnected.');
      } catch (err) {
        app.log.error(err, 'Error disconnecting Redis');
      }

      // 3. Drain PostgreSQL pool
      try {
        const pool = getDbPool();
        await pool.end();
        app.log.info('[URL-Service] PostgreSQL pool ended.');
      } catch (err) {
        app.log.error(err, 'Error closing DB pool');
      }

      app.log.info('[URL-Service] Graceful shutdown completed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[URL-Service] Server (${INSTANCE_NAME}) listening on http://${HOST}:${PORT}`);
    startObservabilityLoops(app.log);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
