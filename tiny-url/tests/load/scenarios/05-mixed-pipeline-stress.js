import http from 'k6/http';
import { check } from 'k6';
import { CDN_URL, LB_URL, THRESHOLDS, SUMMARY_TREND_STATS } from '../config.js';
import { createSummaryHandler } from '../utils/reporter.js';

export const options = {
  summaryTrendStats: SUMMARY_TREND_STATS,
  scenarios: {
    mixed_traffic: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '5s', target: 40 },
        { duration: '20s', target: 80 },
        { duration: '5s', target: 0 },
      ],
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
      original_url: `https://news.ycombinator.com/item?id=${100000 + i}`,
    });
    const res = http.post(`${LB_URL}/api/v1/urls`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 201) {
      codes.push(res.json('short_code'));
    }
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
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Mixed_Write' },
    });
    check(res, {
      'write status 201': (r) => r.status === 201,
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
