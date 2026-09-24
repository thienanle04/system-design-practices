import { execSync } from 'child_process';

function execDocker(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (err) {
    return null;
  }
}

async function verify() {
  console.log('\n================================================================================');
  console.log('🔍 PIPELINE DATA RECONCILIATION & LAG AUDIT');
  console.log('================================================================================');

  // 1. Check PostgreSQL stats
  const totalUrlsStr = execDocker('docker exec tinyurl-postgres psql -U postgres -d tinyurl -t -A -c "SELECT count(*) FROM urls;"');
  const totalClicksStr = execDocker('docker exec tinyurl-postgres psql -U postgres -d tinyurl -t -A -c "SELECT count(*) FROM url_clicks;"');
  const dailyClicksStr = execDocker('docker exec tinyurl-postgres psql -U postgres -d tinyurl -t -A -c "SELECT COALESCE(SUM(clicks), 0) FROM url_analytics_daily;"');

  const totalUrls = parseInt(totalUrlsStr || '0', 10);
  const totalClicks = parseInt(totalClicksStr || '0', 10);
  const dailyAggregatedClicks = parseInt(dailyClicksStr || '0', 10);

  // 2. Check Redis Key Buffer Depth
  const keyDepthStr = execDocker('docker exec tinyurl-redis redis-cli llen kgs:available_keys');
  const keyBufferDepth = parseInt(keyDepthStr || '0', 10);

  // 3. Check Kafka Consumer Group Lag
  const kafkaOutput = execDocker('docker exec tinyurl-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group analytics-consumer-group');

  console.log('\n📊 DATABASE & STORAGE AUDIT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Short URLs in DB      : ${totalUrls.toLocaleString()}`);
  console.log(`Raw Click Events Recorded   : ${totalClicks.toLocaleString()}`);
  console.log(`Aggregated Daily Clicks     : ${dailyAggregatedClicks.toLocaleString()}`);
  console.log(`Current Key Buffer Depth    : ${keyBufferDepth.toLocaleString()} keys`);

  console.log('\n⚡ KAFKA CONSUMER LAG AUDIT (Topic: url-clicks, Group: analytics-consumer-group)');
  console.log('--------------------------------------------------------------------------------');
  let totalLag = 0;
  if (kafkaOutput) {
    const lines = kafkaOutput.split('\n');
    const headerLine = lines.find((l) => l.includes('PARTITION') && l.includes('LAG'));
    const dataLines = lines.filter((l) => l.includes('analytics-consumer-group') && l.includes('url-clicks'));

    if (dataLines.length > 0) {
      for (const line of dataLines) {
        const parts = line.trim().split(/\s+/);
        // Column indices: GROUP(0) TOPIC(1) PARTITION(2) CURRENT-OFFSET(3) LOG-END-OFFSET(4) LAG(5)
        const partition = parts[2];
        const currentOffset = parts[3];
        const logEndOffset = parts[4];
        const lag = parseInt(parts[5] || '0', 10);
        totalLag += isNaN(lag) ? 0 : lag;
        console.log(`Partition ${partition} : Current=${currentOffset} | LogEnd=${logEndOffset} | Lag=${lag}`);
      }
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`Total Consumer Lag : ${totalLag} pending events`);
    } else {
      console.log('No active partition assignments found.');
    }
  } else {
    console.log('⚠️ Unable to execute kafka-consumer-groups command in tinyurl-kafka container.');
  }

  const isLagClean = totalLag === 0;
  const isDataConsistent = totalClicks === dailyAggregatedClicks;

  console.log('\n🛡️  INTEGRITY VERIFICATION RESULT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Pipeline Queue Drained (Lag = 0)       : ${isLagClean ? '✅ PASS' : '⚠️  LAG PENDING (' + totalLag + ' events)'}`);
  console.log(`Analytics Aggregation Consistency     : ${isDataConsistent ? '✅ CONSISTENT' : '⚠️  MISMATCH (Raw=' + totalClicks + ', Agg=' + dailyAggregatedClicks + ')'}`);
  console.log('================================================================================\n');
}

verify();
