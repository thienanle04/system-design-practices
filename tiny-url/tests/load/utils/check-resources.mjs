import { execSync } from 'child_process';

/**
 * Checks whether the current running containers have Resource Budget Profile applied.
 * Inspects tinyurl-api-1 as a canary indicator.
 */
export function checkResourceBudgetProfile() {
  try {
    const rawNanoCpus = execSync(
      'docker inspect tinyurl-api-1 --format "{{.HostConfig.NanoCpus}}"',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const rawMemory = execSync(
      'docker inspect tinyurl-api-1 --format "{{.HostConfig.Memory}}"',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();

    const nanoCpus = parseInt(rawNanoCpus, 10) || 0;
    const memoryBytes = parseInt(rawMemory, 10) || 0;

    if (nanoCpus > 0 || memoryBytes > 0) {
      const vCpus = nanoCpus > 0 ? (nanoCpus / 1e9).toFixed(1) : 'unlimited';
      const memoryMB = memoryBytes > 0 ? Math.round(memoryBytes / (1024 * 1024)) : 'unlimited';
      console.log(`📊 [Resource Budget Profile]: ACTIVE (Canary: tinyurl-api-1 -> ${vCpus} vCPU, ${memoryMB}MB RAM)`);
      return { active: true, vCpus, memoryMB };
    } else {
      console.warn('⚠️  [Resource Budget Profile]: INACTIVE (Running unconstrained)');
      console.warn('   For objective, reproducible benchmarks, launch with: npm run docker:perf:up');
      return { active: false };
    }
  } catch {
    // Non-blocking if container inspect fails
    return { active: false };
  }
}
