import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportsDir = path.resolve(__dirname, '../reports');
const historyFile = path.resolve(reportsDir, 'history.md');

const TABLE_HEADER = `# Load Testing Run History\n\nImmutable record of all benchmark runs across scenarios with workload specifications and SLA verification.\n\n| Timestamp | Scenario | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency p95 | Latency p99 | Fail Rate | SLA Status | Report File |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

function run() {
  if (!fs.existsSync(reportsDir)) {
    console.log('[History] Reports directory does not exist yet.');
    return;
  }

  const files = fs.readdirSync(reportsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      name: f,
      path: path.join(reportsDir, f),
      time: fs.statSync(path.join(reportsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.log('[History] No JSON report files found to index.');
    return;
  }

  const latestFile = files[0];
  try {
    const raw = fs.readFileSync(latestFile.path, 'utf-8');
    const data = JSON.parse(raw);

    const m = data.metrics || {};
    const reqDuration = m.http_req_duration ? m.http_req_duration.values : {};
    const reqs = m.http_reqs ? m.http_reqs.values : { count: 0, rate: 0 };
    const failedReqs = m.http_req_failed ? m.http_req_failed.values : { rate: 0 };
    const vusMax = m.vus_max ? m.vus_max.values.value : (m.vus ? m.vus.values.value : 'N/A');

    const meta = data.test_metadata || {};
    const scenarioName = meta.title || latestFile.name.replace(/-202\d-.*\.json$/, '');
    const timestampMatch = latestFile.name.match(/(202\d-[0-9T-]+)\.json/);
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

    const target = meta.targetIngress || 'N/A';
    const duration = meta.durationActual || meta.durationConfigured || 'N/A';
    const totalReqs = reqs.count || 0;
    const rps = (reqs.rate || 0).toFixed(1);
    const failRate = ((failedReqs.rate || 0) * 100).toFixed(2);
    const p95 = reqDuration['p(95)'] !== undefined ? `${reqDuration['p(95)'].toFixed(2)}ms` : 'N/A';
    const p99 = reqDuration['p(99)'] !== undefined ? `${reqDuration['p(99)'].toFixed(2)}ms` : 'N/A';
    const htmlFilename = latestFile.name.replace('.json', '.html');

    const slaStatus = meta.slaStatus || (parseFloat(failRate) === 0 ? 'PASS' : 'VIOLATED');
    const slaBadge = slaStatus === 'PASS' ? '`PASS`' : (slaStatus === 'VIOLATED' ? '**`VIOLATED`**' : '`N/A`');

    // Ensure history file has header
    if (!fs.existsSync(historyFile)) {
      fs.writeFileSync(historyFile, TABLE_HEADER, 'utf-8');
    } else {
      const current = fs.readFileSync(historyFile, 'utf-8');
      // If history file exists with legacy columns, upgrade header
      if (!current.includes('SLA Status')) {
        fs.writeFileSync(historyFile, TABLE_HEADER, 'utf-8');
      }
    }

    const currentHistory = fs.readFileSync(historyFile, 'utf-8');
    if (currentHistory.includes(latestFile.name.replace('.json', ''))) {
      console.log(`[History] Report ${latestFile.name} already recorded in history.`);
      return;
    }

    const row = `| \`${timestamp}\` | **${scenarioName}** | \`${target}\` | ${duration} | ${vusMax} | ${totalReqs.toLocaleString()} | ${rps} | ${p95} | ${p99} | ${failRate}% | ${slaBadge} | [\`${htmlFilename}\`](./${htmlFilename}) |\n`;
    fs.appendFileSync(historyFile, row, 'utf-8');
    console.log(`[History] Appended latest run (${scenarioName}) to ${historyFile}`);
  } catch (err) {
    console.error(`[History] Failed to append history for ${latestFile.name}:`, err);
  }
}

run();
