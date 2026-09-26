import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { LB_URL, THRESHOLDS, SUMMARY_TREND_STATS, getRampingStages, VUS_PROFILE } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

const unexpectedErrors = new Rate('unexpected_errors');

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    cache_penetration_attack: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: getRampingStages(VUS_PROFILE.NEGATIVE_CACHE),
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.NEGATIVE_CACHE,
};

export const metadata = {
  title: '03 - Cache Penetration Defense Benchmark',
  targetIngress: 'Load Balancer (http://load-balancer)',
  targetLayer: 'Redis Negative Caching (__NOT_FOUND__)',
  adr: 'ADR-0003',
  workloadType: 'Penetration Attack (20 Non-Existent Ghost Keys)',
  notes: 'Simulates attack targeting non-existent short codes to verify negative cache defense prevents DB collapse.',
};

// Fixed pool of 20 non-existent Short Codes to simulate repeat penetration hitting Negative Cache
const MISSING_CODES = Array.from({ length: 20 }, (_, i) => `ghost_key_${i}_${Date.now().toString(36)}`);

export default function () {
  // Pick from the repeating set of missing codes to exercise Redis Negative Cache (__NOT_FOUND__)
  const code = MISSING_CODES[Math.floor(Math.random() * MISSING_CODES.length)];

  const res = http.get(`${LB_URL}/${code}`, {
    redirects: 0,
    tags: { name: 'Negative_Cache_Miss' },
  });

  const isExpected404 = res.status === 404;
  const is5xx = res.status >= 500;

  unexpectedErrors.add(is5xx || !isExpected404);

  check(res, {
    'status is 404 Not Found': () => isExpected404,
    'no 5xx database collapse': () => !is5xx,
    'handled by service node': (r) => Boolean(r.headers['X-Server-Instance']),
  });
}

export const handleSummary = createSummaryHandler('03-cache-penetration', {
  ...metadata,
  options,
});
