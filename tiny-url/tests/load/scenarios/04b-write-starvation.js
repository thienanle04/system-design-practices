import http from 'k6/http';
import { check, sleep } from 'k6';
import { LB_URL, THRESHOLDS, SUMMARY_TREND_STATS } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    write_buffer_starvation_burst: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '3s', target: 50 },
        { duration: '15s', target: 120 }, // High VU burst to drain Redis key buffer faster than KGS 5s cycle
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.WRITE_STARVATION,
};

export const metadata = {
  title: '04b - Key Buffer Exhaustion & Resilience Benchmark',
  targetIngress: 'Load Balancer (http://load-balancer)',
  targetLayer: 'Key Buffer Exhaustion & KGS Self-Healing',
  adr: 'ADR-0001, ADR-0006',
  workloadType: '100% Write Burst (Buffer Depletion Stress)',
  notes: 'High VU burst to drain Redis key buffer faster than KGS 5s cycle, verifying fallback safety and self-healing.',
};

export default function () {
  const uniqueUrl = `https://starvation-test.internal/batch-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    original_url: uniqueUrl,
  });

  const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'Burst_Create_Short_URL' },
  });

  check(res, {
    'status is 201 Created': (r) => r.status === 201,
    'resilient key allocated': (r) => Boolean(r.json('short_code')),
  });
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
