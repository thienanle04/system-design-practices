import http from 'k6/http';
import { check } from 'k6';
import { LB_URL, THRESHOLDS, SUMMARY_TREND_STATS, getRampingStages, VUS_PROFILE } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    write_steady_throughput: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: getRampingStages(VUS_PROFILE.WRITE_STEADY),
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.WRITE_STEADY,
};

export const metadata = {
  title: '04a - Steady-State Short URL Creation Benchmark',
  targetIngress: 'Load Balancer (http://load-balancer)',
  targetLayer: 'Key Buffer LPOP + PostgreSQL URL Insertion',
  adr: 'ADR-0001',
  workloadType: '100% Write (Unique Short URL Creation)',
  notes: 'Measures write throughput under abundant pre-generated key buffer availability.',
};

export default function (data, vuContext) {
  const vuId = __VU;
  const iterId = __ITER;
  const uniqueUrl = `https://benchmark.service.internal/articles/post-${vuId}-${iterId}-${Date.now()}`;

  const payload = JSON.stringify({
    original_url: uniqueUrl,
  });

  const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'paid_demo_key',
    },
    tags: { name: 'Create_Short_URL' },
    responseCallback: http.expectedStatuses(201, 429),
  });

  check(res, {
    'resilient status (201 Created or 429 Rate Limited)': (r) => r.status === 201 || r.status === 429,
    'successful write has valid short_code': (r) => r.status !== 201 || Boolean(r.json('short_code')),
    'successful write target url matches': (r) => r.status !== 201 || r.json('original_url') === uniqueUrl,
  });
}

export const handleSummary = createSummaryHandler('04a-write-steady', {
  ...metadata,
  options,
});
