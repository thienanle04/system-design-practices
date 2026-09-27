import http from 'k6/http';
import { check } from 'k6';
import { CDN_URL, LB_URL, THRESHOLDS, SUMMARY_TREND_STATS, getRampingStages, VUS_PROFILE } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    mixed_traffic: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: getRampingStages(VUS_PROFILE.MIXED, { rampUpSec: '5s', steadySec: '20s', rampDownSec: '5s' }),
      gracefulRampDown: '2s',
    },
  },
  thresholds: THRESHOLDS.MIXED,
};

export const metadata = {
  title: '05 - Mixed Read/Write & Kafka Event Streaming Stress',
  targetIngress: 'Mock CDN (Read) & Load Balancer (Write)',
  targetLayer: 'End-to-End Pipeline (Edge, Origin, Redis, Kafka, Analytics)',
  adr: 'ADR-0004',
  workloadType: 'Mixed Workload (90% Read, 10% Write)',
  notes: 'Simulates realistic user traffic with asynchronous Kafka event streaming for click tracking.',
};

export function setup() {
  const seedCount = 30;
  console.log(`[Setup] Pre-seeding ${seedCount} Short URLs for mixed workload...`);
  const codes = [];

  for (let i = 0; i < seedCount; i++) {
    const payload = JSON.stringify({
      original_url: `https://news.ycombinator.com/item?id=${100000 + i}-${Date.now()}`,
    });
    const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'paid_demo_key',
      },
    });
    if (res.status === 201) {
      codes.push(res.json('short_code'));
    }
  }

  if (codes.length === 0) {
    throw new Error('Failed to seed Short URLs in setup(). Check rate limits or API key status.');
  }

  return { codes };
}

export default function (data) {
  const rand = Math.random() * 100;

  if (rand < 10) {
    // 10% Write Traffic: Create new Short URL
    const payload = JSON.stringify({
      original_url: `https://docs.github.com/en/get-started/${__VU}-${__ITER}-${Date.now()}`,
    });
    const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'paid_demo_key',
      },
      tags: { name: 'Mixed_Write' },
      responseCallback: http.expectedStatuses(201, 429),
    });
    check(res, {
      'write status (201 Created or 429 Rate Limited)': (r) => r.status === 201 || r.status === 429,
    });
  } else {
    // 90% Read Traffic: Redirect request hitting Mock CDN Edge
    const code = data.codes[Math.floor(Math.random() * data.codes.length)];
    const res = http.get(`${CDN_URL}/${code}`, {
      redirects: 0,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
      tags: { name: 'Mixed_Read_Redirect' },
    });
    check(res, {
      'read redirect 302': (r) => r.status === 302,
    });
  }
}

export const handleSummary = createSummaryHandler('05-mixed-pipeline-stress', {
  ...metadata,
  options,
});
