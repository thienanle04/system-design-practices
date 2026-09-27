import http from 'k6/http';
import { check, sleep } from 'k6';
import { LB_URL, THRESHOLDS, SUMMARY_TREND_STATS, getRampingStages, VUS_PROFILE } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    write_buffer_starvation_burst: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: getRampingStages(VUS_PROFILE.WRITE_STARVATION, { rampUpSec: '3s', steadySec: '15s', rampDownSec: '5s' }),
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.WRITE_STARVATION,
};

export const metadata = {
  title: '04b - Key Buffer Exhaustion & Rate Limiting Benchmark',
  targetIngress: 'Load Balancer (http://load-balancer)',
  targetLayer: 'Key Buffer Exhaustion, Rate Limiting & Fail-Fast 503',
  adr: 'ADR-0001, ADR-0006, ADR-0010',
  workloadType: '100% Write Burst (Buffer Depletion & Rate Limit Stress)',
  notes: 'High VU burst verifying rate-limit enforcement for guests and fail-fast 503 / self-healing under extreme write bursts.',
};

export default function () {
  const isGuestCheck = __VU === 1 && __ITER < 10;
  const uniqueUrl = `https://starvation-test.internal/batch-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    original_url: uniqueUrl,
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  if (!isGuestCheck) {
    headers['X-API-Key'] = 'paid_demo_key';
  }

  const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
    headers,
    tags: { name: isGuestCheck ? 'Guest_RateLimit_Check' : 'Burst_Create_Short_URL' },
    responseCallback: http.expectedStatuses(201, 429, 503),
  });

  if (isGuestCheck) {
    // Guest requests beyond limit (5/min) should receive 429
    check(res, {
      'guest receives 201 or 429': (r) => r.status === 201 || r.status === 429,
      'guest 429 has retry-after': (r) => r.status !== 429 || Boolean(r.headers['Retry-After']),
    });
  } else {
    // Paid burst: 201 (normal) or 503 (buffer depleted fail-fast), never 500
    check(res, {
      'resilient status (201 Created or 503 Key Buffer Depleted)': (r) => r.status === 201 || r.status === 503,
      'fail-fast 503 contains Retry-After': (r) => r.status !== 503 || Boolean(r.headers['Retry-After']),
    });
  }
}

export function teardown() {
  // Give 2 seconds for system to settle and inspect Key Buffer Depth
  sleep(2);
  const statusRes = http.get(`${LB_URL}/api/v1/system/status`);
  if (statusRes.status === 200) {
    const data = statusRes.json();
    const kgs = data.kgs || (data.components && data.components.kgs) || {};
    const depth = kgs.key_buffer_depth !== undefined ? kgs.key_buffer_depth : 'N/A';
    const kgsStatus = kgs.status || 'N/A';
    console.log(`[Teardown Health Check] Key Buffer Depth: ${depth}, KGS Status: ${kgsStatus}, Platform Status: ${data.status}`);
  }
}

export const handleSummary = createSummaryHandler('04b-write-starvation', {
  ...metadata,
  options,
});
