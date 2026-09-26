export const CDN_URL = __ENV.CDN_URL || 'http://mock-cdn';
export const LB_URL = __ENV.LB_URL || 'http://load-balancer';
export const API_URL = __ENV.API_URL || 'http://load-balancer';
export const NETWORK_PROFILE = __ENV.NETWORK_PROFILE || 'baseline';

export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

// Nominal Capacity Envelope: Calibrated Virtual Users per scenario based on 0.5 vCPU budget
export const VUS_PROFILE = {
  EDGE_HIT: { baseline: 40, wan: 120 },
  ORIGIN_READ: { baseline: 50, wan: 150 },
  NEGATIVE_CACHE: { baseline: 40, wan: 120 },
  WRITE_STEADY: { baseline: 20, wan: 60 },
  WRITE_STARVATION: { baseline: 80, wan: 180 },
  MIXED: { baseline: 40, wan: 120 },
};

// Baseline Profile (Profile A): Calibrated for Resource Budget Profile (0.5 vCPU compute nodes)
export const THRESHOLDS_BASELINE = {
  // Edge Cache Hit: sub-millisecond memory cache under 0.5 vCPU
  EDGE_HIT: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<10', 'p(99)<25'],
  },
  // Origin Fastify + Redis Cache-Aside across 2 nodes (0.5 vCPU each)
  ORIGIN_READ: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<40', 'p(99)<70'],
  },
  // Negative Cache: 404 is expected, 5xx is failure, fast rejection via Redis
  NEGATIVE_CACHE: {
    unexpected_errors: ['rate<0.01'],
    http_req_duration: ['p(95)<25', 'p(99)<50'],
  },
  // Write Steady: POST /api/v1/urls with healthy buffer & PostgreSQL 1.0 vCPU
  WRITE_STEADY: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<120', 'p(99)<250'],
  },
  // Write Starvation: Buffer exhaustion & HTTP 503 / 429 backpressure handling
  WRITE_STARVATION: {
    http_req_duration: ['p(95)<350'],
  },
  // Mixed: 90% Read + 10% Write with Kafka event streaming
  MIXED: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<90', 'p(99)<220'],
  },
};

// Emulated WAN Profile (Profile B): Under injected RTT (Client->Edge ~30ms, Edge->Origin ~50ms)
export const THRESHOLDS_WAN = {
  EDGE_HIT: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<70', 'p(99)<85'],
  },
  ORIGIN_READ: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200', 'p(99)<250'],
  },
  NEGATIVE_CACHE: {
    unexpected_errors: ['rate<0.01'],
    http_req_duration: ['p(95)<90', 'p(99)<120'],
  },
  WRITE_STEADY: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<220', 'p(99)<300'],
  },
  WRITE_STARVATION: {
    http_req_duration: ['p(95)<450'],
  },
  MIXED: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<200', 'p(99)<280'],
  },
};

export const THRESHOLDS = NETWORK_PROFILE === 'wan' ? THRESHOLDS_WAN : THRESHOLDS_BASELINE;

/**
 * Computes stages dynamically based on baseline vs WAN profile or custom VUS env var.
 * Supports VUS_PROFILE objects or direct numbers.
 */
export function getRampingStages(profileOrBaseline, wanPeakOrOptions = 120, maybeOptions = {}) {
  let baselinePeak;
  let wanPeak;
  let options;

  if (typeof profileOrBaseline === 'object' && profileOrBaseline !== null && 'baseline' in profileOrBaseline) {
    baselinePeak = profileOrBaseline.baseline;
    wanPeak = profileOrBaseline.wan;
    options = typeof wanPeakOrOptions === 'object' ? wanPeakOrOptions : maybeOptions;
  } else {
    baselinePeak = profileOrBaseline;
    wanPeak = typeof wanPeakOrOptions === 'number' ? wanPeakOrOptions : 120;
    options = maybeOptions;
  }

  const { rampUpSec = '5s', steadySec = '15s', rampDownSec = '5s' } = options || {};
  const peak = __ENV.VUS
    ? parseInt(__ENV.VUS, 10)
    : (NETWORK_PROFILE === 'wan' ? wanPeak : baselinePeak);
  const mid = Math.round(peak / 2);
  return [
    { duration: rampUpSec, target: mid },
    { duration: steadySec, target: peak },
    { duration: rampDownSec, target: 0 },
  ];
}
