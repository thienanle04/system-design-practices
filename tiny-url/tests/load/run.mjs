import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenarioArg = process.argv[2] || '01-hotkey-cache-hit';
const scenarioFile = scenarioArg.endsWith('.js') ? scenarioArg : `${scenarioArg}.js`;
const composeFile = path.resolve(__dirname, 'docker-compose.perf.yml');

console.log(`\n🚀 Launching k6 benchmark: [${scenarioFile}] in Docker network...`);

const dockerArgs = [
  'compose',
  '-f',
  composeFile,
  'run',
  '--rm',
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
