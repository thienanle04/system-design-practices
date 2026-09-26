import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportsDir = path.resolve(__dirname, '../reports');
const masterIndexFile = path.resolve(reportsDir, 'README.md');
const legacyHistoryFile = path.resolve(reportsDir, 'history.md');

const SCENARIO_CATALOG = [
  { id: '01-hotkey-cache-hit', title: '01 - Edge Cache Saturation & Hotkey Benchmark' },
  { id: '02-origin-cache-miss', title: '02 - Origin Fastify & Redis Cache-Aside Benchmark' },
  { id: '03-cache-penetration', title: '03 - Cache Penetration Defense (Negative Caching)' },
  { id: '04a-write-steady', title: '04a - Steady-State Short URL Creation' },
  { id: '04b-write-starvation', title: '04b - Key Buffer Starvation & KGS Self-Healing' },
  { id: '05-mixed-pipeline-stress', title: '05 - Mixed Pipeline Real-World Stress' },
];

function formatMs(val) {
  if (val === undefined || val === null) return 'N/A';
  return `${val.toFixed(2)}ms`;
}

function detectProfile(data, fileName) {
  const meta = data.test_metadata || {};
  if (meta.networkProfile) {
    return meta.networkProfile.toUpperCase();
  }
  if (fileName.includes('-wan-')) {
    return 'WAN';
  }
  const thresholds = (data.metrics?.http_req_duration?.thresholds) || {};
  if (thresholds['p(95)<70'] || thresholds['p(95)<200'] || thresholds['p(95)<90']) {
    return 'WAN';
  }
  const avg = data.metrics?.http_req_duration?.values?.avg || 0;
  if (avg > 25) {
    return 'WAN';
  }
  return 'BASELINE';
}

function parseReportFile(filePath, fileName) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const m = data.metrics || {};
  const reqDuration = m.http_req_duration ? m.http_req_duration.values : {};
  const reqs = m.http_reqs ? m.http_reqs.values : { count: 0, rate: 0 };
  const failedReqs = m.http_req_failed ? m.http_req_failed.values : { rate: 0 };
  const vusMax = m.vus_max ? m.vus_max.values.value : (m.vus ? m.vus.values.value : 'N/A');

  const meta = data.test_metadata || {};
  const scenarioTitle = meta.title || fileName.replace(/-202\d-.*\.json$/, '');
  const timestampMatch = fileName.match(/(202\d-[0-9T-]+)\.json/);
  const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

  const profile = detectProfile(data, fileName);
  const profileBadge = profile === 'WAN' ? '`WAN`' : '`BASELINE`';

  const target = meta.targetIngress || 'N/A';
  const duration = meta.durationActual || meta.durationConfigured || 'N/A';
  const totalReqs = reqs.count || 0;
  const rps = (reqs.rate || 0).toFixed(1);
  const failRate = ((failedReqs.rate || 0) * 100).toFixed(2);

  const avg = formatMs(reqDuration.avg);
  const p95 = formatMs(reqDuration['p(95)']);
  const p99 = formatMs(reqDuration['p(99)']);
  const max = formatMs(reqDuration.max);

  const htmlFilename = fileName.replace('.json', '.html');
  const slaStatus = meta.slaStatus || (parseFloat(failRate) === 0 ? 'PASS' : 'VIOLATED');
  const slaBadge = slaStatus === 'PASS' ? '`PASS`' : (slaStatus === 'VIOLATED' ? '**`VIOLATED`**' : '`N/A`');

  return {
    fileName,
    htmlFilename,
    timestamp,
    scenarioTitle,
    profile,
    profileBadge,
    target,
    duration,
    vusMax,
    totalReqs,
    rps,
    failRate,
    avg,
    p95,
    p99,
    max,
    slaStatus,
    slaBadge,
  };
}

function migrateFlatFiles() {
  if (!fs.existsSync(reportsDir)) return;
  const items = fs.readdirSync(reportsDir);
  for (const item of items) {
    if (item.endsWith('.json') || item.endsWith('.html')) {
      const match = item.match(/^([0-9a-z-]+)-(?:wan-)?202\d-[0-9T-]+\.(?:json|html)$/);
      if (match) {
        let scenarioDirName = match[1];
        if (scenarioDirName.endsWith('-wan')) {
          scenarioDirName = scenarioDirName.replace(/-wan$/, '');
        }
        const targetSubdir = path.join(reportsDir, scenarioDirName);
        if (!fs.existsSync(targetSubdir)) {
          fs.mkdirSync(targetSubdir, { recursive: true });
        }
        const oldPath = path.join(reportsDir, item);
        const newPath = path.join(targetSubdir, item);
        fs.renameSync(oldPath, newPath);
        console.log(`[Migration] Moved ${item} -> ${scenarioDirName}/`);
      }
    }
  }

  // Remove legacy root history.md if it exists
  if (fs.existsSync(legacyHistoryFile)) {
    fs.unlinkSync(legacyHistoryFile);
    console.log('[Migration] Removed deprecated flat reports/history.md');
  }
}

function buildScenarioHistory(scenarioDirName) {
  const scenarioPath = path.join(reportsDir, scenarioDirName);
  if (!fs.existsSync(scenarioPath) || !fs.statSync(scenarioPath).isDirectory()) {
    return null;
  }

  const jsonFiles = fs.readdirSync(scenarioPath)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const fullPath = path.join(scenarioPath, f);
      return {
        name: f,
        path: fullPath,
        time: fs.statSync(fullPath).mtime.getTime(),
      };
    })
    .sort((a, b) => a.time - b.time); // chronological order

  if (jsonFiles.length === 0) {
    return { scenarioDirName, records: [], latestBaseline: null, latestWan: null };
  }

  const records = [];
  let latestBaseline = null;
  let latestWan = null;

  for (const file of jsonFiles) {
    try {
      const record = parseReportFile(file.path, file.name);
      records.push(record);
      if (record.profile === 'WAN') {
        latestWan = record;
      } else {
        latestBaseline = record;
      }
    } catch (err) {
      console.error(`[History] Error parsing ${file.name}:`, err);
    }
  }

  const catalogEntry = SCENARIO_CATALOG.find((s) => s.id === scenarioDirName);
  const title = catalogEntry ? catalogEntry.title : (records[0]?.scenarioTitle || scenarioDirName);

  let mdContent = `# Scenario Benchmark History: ${title}\n\n`;
  mdContent += `Immutable sequential record of performance benchmark runs and SLA verification for **${title}**.\n\n`;
  mdContent += `[⬅️ Back to Benchmark Master Index](../README.md)\n\n`;
  mdContent += `| Timestamp | Profile | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency Avg | Latency p95 | Latency p99 | Latency Max | Fail Rate | SLA Status | Report File |\n`;
  mdContent += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const r of records) {
    mdContent += `| \`${r.timestamp}\` | ${r.profileBadge} | \`${r.target}\` | ${r.duration} | ${r.vusMax} | ${r.totalReqs.toLocaleString()} | ${r.rps} | ${r.avg} | ${r.p95} | ${r.p99} | ${r.max} | ${r.failRate}% | ${r.slaBadge} | [\`${r.htmlFilename}\`](./${r.htmlFilename}) |\n`;
  }

  const scenarioHistoryFile = path.join(scenarioPath, 'history.md');
  fs.writeFileSync(scenarioHistoryFile, mdContent, 'utf-8');
  console.log(`[History] Updated ${scenarioDirName}/history.md with ${records.length} runs.`);

  return {
    scenarioDirName,
    title,
    records,
    latestBaseline,
    latestWan,
  };
}

function buildMasterIndex(scenarioResults) {
  let md = `# Benchmark Master Index\n\n`;
  md += `Executive dashboard summarizing the latest performance benchmark runs across all scenarios and network profiles.\n\n`;
  md += `## 📊 Latest Benchmark Snapshot\n\n`;
  md += `| Scenario | Profile | Last Run | Target | VUs Max | Throughput (RPS) | Latency p95 | Fail Rate | SLA Status | Detailed History | Latest Report |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const cat of SCENARIO_CATALOG) {
    const res = scenarioResults.find((r) => r.scenarioDirName === cat.id);
    const title = cat.title;
    const historyLink = `[View History](./${cat.id}/history.md)`;

    // Baseline row
    if (res && res.latestBaseline) {
      const b = res.latestBaseline;
      md += `| **${title}** | \`BASELINE\` | \`${b.timestamp}\` | \`${b.target}\` | ${b.vusMax} | ${b.rps} | ${b.p95} | ${b.failRate}% | ${b.slaBadge} | ${historyLink} | [\`${b.htmlFilename}\`](./${cat.id}/${b.htmlFilename}) |\n`;
    } else {
      md += `| **${title}** | \`BASELINE\` | _Not executed_ | - | - | - | - | - | \`PENDING\` | ${historyLink} | - |\n`;
    }

    // WAN row
    if (res && res.latestWan) {
      const w = res.latestWan;
      md += `| **${title}** | \`WAN\` | \`${w.timestamp}\` | \`${w.target}\` | ${w.vusMax} | ${w.rps} | ${w.p95} | ${w.failRate}% | ${w.slaBadge} | ${historyLink} | [\`${w.htmlFilename}\`](./${cat.id}/${w.htmlFilename}) |\n`;
    } else {
      md += `| **${title}** | \`WAN\` | _Not executed_ | - | - | - | - | - | \`PENDING\` | ${historyLink} | - |\n`;
    }
  }

  md += `\n---\n\n`;
  md += `## 📁 Scenario Benchmark Directories\n\n`;
  for (const cat of SCENARIO_CATALOG) {
    md += `- [**${cat.title}**](./${cat.id}/history.md)\n`;
  }
  md += `\n`;

  fs.writeFileSync(masterIndexFile, md, 'utf-8');
  console.log(`[Master Index] Updated ${masterIndexFile}`);
}

function run() {
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 1. Migrate flat files if any exist
  migrateFlatFiles();

  // 2. Discover all scenario subdirectories
  const subdirs = fs.readdirSync(reportsDir)
    .filter((f) => {
      const full = path.join(reportsDir, f);
      return fs.statSync(full).isDirectory();
    });

  // Ensure all known catalog directories are included
  const allScenarioDirs = Array.from(new Set([...SCENARIO_CATALOG.map((s) => s.id), ...subdirs]));

  const scenarioResults = [];
  for (const dirName of allScenarioDirs) {
    const res = buildScenarioHistory(dirName);
    if (res) {
      scenarioResults.push(res);
    }
  }

  // 3. Build master dashboard README.md
  buildMasterIndex(scenarioResults);
}

run();
