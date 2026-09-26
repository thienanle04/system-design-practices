import fs from 'fs';
import { spawnSync, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawArgs = process.argv.slice(2);
let scenarioArg = '01-hotkey-cache-hit';
let cliVus = process.env.VUS;

let scenarioSet = false;
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith('--vus=')) {
    cliVus = arg.split('=')[1];
  } else if (arg === '--vus' && rawArgs[i + 1]) {
    cliVus = rawArgs[++i];
  } else if (/^\d+$/.test(arg)) {
    cliVus = arg;
  } else if (!arg.startsWith('-') && !scenarioSet) {
    scenarioArg = arg;
    scenarioSet = true;
  }
}

const scenarioFile = scenarioArg.endsWith('.js') ? scenarioArg : `${scenarioArg}.js`;
const scenarioBase = scenarioFile.replace(/\.js$/, '');
const composeFile = path.resolve(__dirname, 'docker-compose.perf.yml');
const scenarioReportsDir = path.resolve(__dirname, 'reports', scenarioBase);
if (!fs.existsSync(scenarioReportsDir)) {
  fs.mkdirSync(scenarioReportsDir, { recursive: true });
}

function cleanupNetem() {
  console.log('\n🧹 Cleaning up Emulated WAN Latency rules (restoring baseline)...');
  try {
    execSync('docker exec tinyurl-cdn tc qdisc del dev eth0 root', { stdio: 'ignore' });
  } catch (_) {
    // Ignore if not set
  }
  try {
    execSync('docker exec tinyurl-lb tc qdisc del dev eth0 root', { stdio: 'ignore' });
  } catch (_) {
    // Ignore if not set
  }
  console.log('✅ Network rules cleared. Restored zero-delay baseline.');
}

function setupNetem() {
  console.log('\n🌐 Setting up Emulated WAN Latency (tc netem) on Docker containers...');
  // Clear any existing rules first
  try {
    execSync('docker exec tinyurl-cdn tc qdisc del dev eth0 root', { stdio: 'ignore' });
  } catch (_) {}
  try {
    execSync('docker exec tinyurl-lb tc qdisc del dev eth0 root', { stdio: 'ignore' });
  } catch (_) {}

  // Inject 30ms ± 5ms on mock-cdn (Client <-> Edge WAN hop)
  execSync('docker exec tinyurl-cdn tc qdisc add dev eth0 root netem delay 30ms 5ms', { stdio: 'inherit' });
  console.log('  → [tinyurl-cdn] Applied Client <-> Edge WAN latency: 30ms (±5ms jitter)');

  // Inject 50ms ± 10ms on load-balancer (Edge <-> Origin Backbone hop)
  execSync('docker exec tinyurl-lb tc qdisc add dev eth0 root netem delay 50ms 10ms', { stdio: 'inherit' });
  console.log('  → [tinyurl-lb]  Applied Edge <-> Origin Backbone latency: 50ms (±10ms jitter)');
}

// Ensure cleanup on interrupt
process.on('SIGINT', () => {
  cleanupNetem();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupNetem();
  process.exit(143);
});

import { checkResourceBudgetProfile } from './utils/check-resources.mjs';

let exitCode = 0;

try {
  checkResourceBudgetProfile();
  setupNetem();

  console.log(`\n🚀 Launching k6 benchmark (Profile: WAN): [${scenarioFile}] in Docker network...`);

  const vusArgs = cliVus ? ['-e', `VUS=${cliVus}`] : [];

  const dockerArgs = [
    'compose',
    '-f',
    composeFile,
    'run',
    '--rm',
    '-e',
    'NETWORK_PROFILE=wan',
    ...vusArgs,
    'k6',
    'run',
    `scenarios/${scenarioFile}`,
  ];

  const k6Result = spawnSync('docker', dockerArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname,
  });

  exitCode = k6Result.status || 0;
} catch (err) {
  console.error('❌ Error during WAN performance run:', err);
  exitCode = 1;
} finally {
  cleanupNetem();

  // Run history recorder regardless of exit code if JSON was generated
  const historyScript = path.resolve(__dirname, 'scripts/append-history.mjs');
  spawnSync('node', [historyScript], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname,
  });
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
