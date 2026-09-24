import { Kafka } from 'kafkajs';
import pg from 'pg';
import Redis from 'ioredis';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tinyurl';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6380);

async function verify() {
  console.log('\n================================================================================');
  console.log('🔍 PIPELINE DATA RECONCILIATION & LAG AUDIT');
  console.log('================================================================================');

  // 1. Check PostgreSQL metrics
  let totalClicks = 0;
  let dailyAggregatedClicks = 0;
  let totalUrls = 0;
  let dbPool: pg.Pool | null = null;

  try {
    dbPool = new Pool({ connectionString: DATABASE_URL });
    const clicksRes = await dbPool.query('SELECT COUNT(*)::int as count FROM url_clicks;');
    totalClicks = clicksRes.rows[0]?.count ?? 0;

    const dailyRes = await dbPool.query('SELECT COALESCE(SUM(click_count), 0)::int as total FROM daily_metrics;');
    dailyAggregatedClicks = dailyRes.rows[0]?.total ?? 0;

    const urlsRes = await dbPool.query('SELECT COUNT(*)::int as count FROM urls;');
    totalUrls = urlsRes.rows[0]?.count ?? 0;
  } catch (err: any) {
    console.error('❌ Failed to query PostgreSQL:', err.message);
  } finally {
    if (dbPool) await dbPool.end();
  }

  // 2. Check Redis Key Buffer Depth
  let keyBufferDepth = 0;
  try {
    const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });
    await redis.connect();
    keyBufferDepth = await redis.llen('kgs:available_keys');
    await redis.quit();
  } catch (err: any) {
    console.error('❌ Failed to query Redis:', err.message);
  }

  // 3. Check Kafka Consumer Lag
  let totalLag = 0;
  const partitionLags: Array<{ partition: number; topicOffset: number; consumerOffset: number; lag: number }> = [];

  try {
    const kafka = new Kafka({
      clientId: 'pipeline-verifier',
      brokers: KAFKA_BROKERS,
    });
    const admin = kafka.admin();
    await admin.connect();

    const topic = 'url-clicks';
    const groupId = 'analytics-consumer-group';

    const topicOffsets = await admin.fetchTopicOffsets(topic);
    const groupOffsets = await admin.fetchOffsets({ groupId, topics: [topic] });

    const groupTopicOffsets = groupOffsets.find((t) => t.topic === topic)?.partitions || [];

    for (const p of topicOffsets) {
      const topicHigh = Number(p.high);
      const consumerP = groupTopicOffsets.find((gp) => gp.partition === p.partition);
      const consumerOffset = consumerP ? Number(consumerP.offset) : 0;
      const lag = Math.max(0, topicHigh - consumerOffset);

      totalLag += lag;
      partitionLags.push({
        partition: p.partition,
        topicOffset: topicHigh,
        consumerOffset,
        lag,
      });
    }

    await admin.disconnect();
  } catch (err: any) {
    console.warn('⚠️  Could not fetch Kafka Admin offsets (might be direct internal broker):', err.message);
  }

  console.log('\n📊 DATABASE & STORAGE AUDIT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Short URLs in DB      : ${totalUrls.toLocaleString()}`);
  console.log(`Raw Click Events Recorded   : ${totalClicks.toLocaleString()}`);
  console.log(`Aggregated Daily Clicks     : ${dailyAggregatedClicks.toLocaleString()}`);
  console.log(`Current Key Buffer Depth    : ${keyBufferDepth.toLocaleString()} keys`);

  console.log('\n⚡ STREAMING CONSUMER LAG (Topic: url-clicks, Group: analytics-consumer-group)');
  console.log('--------------------------------------------------------------------------------');
  if (partitionLags.length > 0) {
    for (const p of partitionLags) {
      console.log(`Partition ${p.partition} : Latest Offset = ${p.topicOffset} | Committed = ${p.consumerOffset} | Lag = ${p.lag}`);
    }
    console.log(`Total Consumer Lag : ${totalLag} events`);
  } else {
    console.log('No partition lag details available.');
  }

  const isLagClean = totalLag === 0;
  const isDataConsistent = totalClicks === dailyAggregatedClicks;

  console.log('\n🛡️  INTEGRITY VERIFICATION RESULT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Pipeline Queue Drained (Lag = 0)       : ${isLagClean ? '✅ PASS' : '⚠️  LAG PENDING (' + totalLag + ' events)'}`);
  console.log(`Analytics Aggregation Consistency     : ${isDataConsistent ? '✅ CONSISTENT' : '⚠️  MISMATCH (Raw=' + totalClicks + ', Agg=' + dailyAggregatedClicks + ')'}`);
  console.log('================================================================================\n');
}

verify().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
