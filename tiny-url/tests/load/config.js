export const CDN_URL = __ENV.CDN_URL || 'http://mock-cdn';
export const LB_URL = __ENV.LB_URL || 'http://load-balancer';
export const API_URL = __ENV.API_URL || 'http://load-balancer';

export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

export const THRESHOLDS = {
  // Edge Cache Hit: sub-millisecond to low millisecond latency
  EDGE_HIT: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<15', 'p(99)<30'],
  },
  // Origin Fastify + Redis Cache-Aside
  ORIGIN_READ: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<60', 'p(99)<150'],
  },
  // Negative Cache: 404 is expected, 5xx is failure
  NEGATIVE_CACHE: {
    'http_req_duration{status:404}': ['p(95)<30', 'p(99)<80'],
    http_req_failed: ['rate<0.01'], // 404 is checked via checks, not counted as failed if configured
  },
  // Write Steady: POST /api/v1/urls with healthy buffer
  WRITE_STEADY: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<100', 'p(99)<250'],
  },
  // Write Starvation: We observe system status and response behavior under exhaustion
  WRITE_STARVATION: {
    http_req_duration: ['p(95)<300'],
  },
  // Mixed: 90% Read + 10% Write
  MIXED: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<80', 'p(99)<200'],
  },
};
