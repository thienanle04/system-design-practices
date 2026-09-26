import http from 'k6/http';
import { check } from 'k6';
import { CDN_URL, LB_URL, THRESHOLDS, SUMMARY_TREND_STATS, getRampingStages, VUS_PROFILE } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    hotkey_edge_cache: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: getRampingStages(VUS_PROFILE.EDGE_HIT),
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.EDGE_HIT,
};

export const metadata = {
  title: '01 - Edge Cache Saturation & Hotkey Benchmark',
  targetIngress: 'Mock CDN (http://mock-cdn)',
  targetLayer: 'Nginx Edge Caching (HTTP 302, s-maxage=30)',
  adr: 'ADR-0002',
  workloadType: '100% Read (Edge Cache HIT)',
  notes: 'Primed edge cache with 30s TTL. Directs 302 redirects with redirects: 0.',
};

export function setup() {
  // 1. Create a Short URL via Origin LB
  const payload = JSON.stringify({
    original_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
  });
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const createRes = http.post(`${LB_URL}/api/v1/urls`, payload, params);
  if (createRes.status !== 201) {
    throw new Error(`Failed to create seed URL in setup: ${createRes.status} ${createRes.body}`);
  }

  const shortCode = createRes.json('short_code');
  console.log(`[Setup] Created hot Short Code: ${shortCode}`);

  // 2. Prime the Mock CDN Edge Cache (1st request will MISS and cache for s-maxage=30s)
  const warmRes = http.get(`${CDN_URL}/${shortCode}`, { redirects: 0 });
  console.log(`[Setup] Primed Edge Cache. Status: ${warmRes.status}, Cache Header: ${warmRes.headers['X-Cache-Status']}`);

  return { shortCode };
}

export default function (data) {
  // Direct requests to Mock CDN Edge Cache with redirects disabled to inspect 302
  const res = http.get(`${CDN_URL}/${data.shortCode}`, {
    redirects: 0,
    tags: { name: 'Edge_302_Redirect' },
  });

  check(res, {
    'status is 302': (r) => r.status === 302,
    'edge cache hit': (r) => r.headers['X-Cache-Status'] === 'HIT',
    'location header present': (r) => Boolean(r.headers['Location']),
  });
}

export const handleSummary = createSummaryHandler('01-hotkey-cache-hit', {
  ...metadata,
  options,
});
