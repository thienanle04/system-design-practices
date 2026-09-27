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

import { checkResourceBudgetProfile } from './utils/check-resources.mjs';

const scenarioFile = scenarioArg.endsWith('.js') ? scenarioArg : `${scenarioArg}.js`;
const scenarioBase = scenarioFile.replace(/\.js$/, '');
const composeFile = path.resolve(__dirname, 'docker-compose.perf.yml');
const scenarioReportsDir = path.resolve(__dirname, 'reports', scenarioBase);
if (!fs.existsSync(scenarioReportsDir)) {
  fs.mkdirSync(scenarioReportsDir, { recursive: true });
}

checkResourceBudgetProfile();

try {
  execSync('docker exec tinyurl-redis redis-cli EVAL "for _,k in ipairs(redis.call(\'keys\',\'ratelimit:*\')) do redis.call(\'del\',k) end" 0', { stdio: 'ignore' });
} catch (_) {}

console.log(`\n🚀 Launching k6 benchmark: [${scenarioFile}] in Docker network...`);

const vusArgs = cliVus ? ['-e', `VUS=${cliVus}`] : [];

const dockerArgs = [
  'compose',
  '-f',
  composeFile,
  'run',
  '--rm',
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

// Run history recorder regardless of exit code if JSON was generated
const historyScript = path.resolve(__dirname, 'scripts/append-history.mjs');
spawnSync('node', [historyScript], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
});

if (k6Result.status !== 0) {
  process.exit(k6Result.status || 1);
}
