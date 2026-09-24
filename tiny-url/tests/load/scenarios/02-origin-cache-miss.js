import http from 'k6/http';
import { check } from 'k6';
import { LB_URL, THRESHOLDS, SUMMARY_TREND_STATS } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    origin_cache_aside: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '5s', target: 40 },
        { duration: '15s', target: 150 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.ORIGIN_READ,
};

export const metadata = {
  title: '02 - Origin Fastify & Cache-Aside Benchmark',
  targetIngress: 'Load Balancer (http://load-balancer)',
  targetLayer: 'Fastify Service Nodes + Redis Cache-Aside',
  adr: 'ADR-0006',
  workloadType: '100% Read (Bypass Edge CDN)',
  notes: 'Pre-seeded 50 unique URLs. Uniform random distribution across round-robin origin nodes.',
};

export function setup() {
  const seedCount = 50;
  console.log(`[Setup] Seeding ${seedCount} Short URLs directly through Load Balancer...`);
  const codes = [];

  for (let i = 0; i < seedCount; i++) {
    const payload = JSON.stringify({
      original_url: `https://example.org/resource/${i}-${Date.now()}`,
    });
    const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 201) {
      codes.push(res.json('short_code'));
    }
  }

  console.log(`[Setup] Seeded ${codes.length} Short Codes successfully.`);
  return { codes };
}

export default function (data) {
  const codes = data.codes;
  const randomCode = codes[Math.floor(Math.random() * codes.length)];

  // Request Load Balancer directly (bypasses Edge Cache)
  const res = http.get(`${LB_URL}/${randomCode}`, {
    redirects: 0,
    tags: { name: 'Origin_302_Redirect' },
  });

  check(res, {
    'status is 302': (r) => r.status === 302,
    'handled by service node': (r) => Boolean(r.headers['X-Server-Instance']),
    'redirect destination present': (r) => Boolean(r.headers['Location']),
  });
}

export const handleSummary = createSummaryHandler('02-origin-cache-miss', {
  ...metadata,
  options,
});
