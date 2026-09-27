import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock dependencies from @tiny-url/shared before importing buildApp
vi.mock('@tiny-url/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiny-url/shared')>();

  return {
    ...actual,
    getDb: vi.fn(),
    getRedisClient: vi.fn(),
    getAvailableKeyFromRedis: vi.fn().mockResolvedValue('xyz1234'),
    getUrlFromCache: vi.fn().mockResolvedValue(null),
    setUrlInCache: vi.fn().mockResolvedValue(undefined),
    setNegativeCache: vi.fn().mockResolvedValue(undefined),
    setDeactivatedCache: vi.fn().mockResolvedValue(undefined),
    deleteUrlFromCache: vi.fn().mockResolvedValue(undefined),
    getApiKeyFromCache: vi.fn().mockResolvedValue(null),
    setApiKeyInCache: vi.fn().mockResolvedValue(undefined),
    checkRateLimitAndQuota: vi.fn().mockResolvedValue({
      allowed: true,
      currentRate: 1,
      limitRate: 5,
      remainingRate: 4,
      resetRateSeconds: 55,
      currentQuota: 1,
      limitQuota: 20,
      remainingQuota: 19,
      retryAfterSeconds: 0,
    }),
    publishClickEvent: vi.fn().mockResolvedValue(undefined),
    publishLiveClick: vi.fn().mockResolvedValue(1),
    createRedisSubscriber: vi.fn().mockReturnValue({
      subscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
    }),
    getAvailableKeysCountFromRedis: vi.fn().mockResolvedValue(5000),
    getActiveNodes: vi.fn().mockResolvedValue([
      { instance: 'url-service-1', status: 'ALIVE', last_heartbeat: new Date().toISOString(), age_seconds: 1 },
      { instance: 'url-service-2', status: 'ALIVE', last_heartbeat: new Date().toISOString(), age_seconds: 2 },
    ]),
    getHealthSnapshot: vi.fn().mockResolvedValue(null),
    setHealthSnapshot: vi.fn().mockResolvedValue(undefined),
    checkKafkaHealth: vi.fn().mockResolvedValue({ status: 'UP' }),
  };
});

import { buildApp, getClientIp } from '../app.js';
import * as shared from '@tiny-url/shared';

describe('URL Service In-Memory Fastify API Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false, instanceName: 'test-node', baseUrl: 'http://localhost:8080' });
  });

  describe('GET /health', () => {
    it('should return 200 with status ok and instance name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('ok');
      expect(json.instance).toBe('test-node');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('Client IP Resolution (IP Spoofing Protection)', () => {
    it('should prioritize x-real-ip header over x-forwarded-for', () => {
      const mockReq = {
        headers: {
          'x-real-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
        },
      };
      expect(getClientIp(mockReq)).toBe('203.0.113.195');
    });

    it('should extract client IP from x-forwarded-for if x-real-ip is not present', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
        },
      };
      expect(getClientIp(mockReq)).toBe('192.0.2.1');
    });
  });

  describe('POST /api/v1/urls', () => {
    it('should reject invalid URL format with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/urls',
        payload: {
          original_url: 'not-a-valid-http-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should reject reserved short codes as custom alias', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/urls',
        payload: {
          original_url: 'https://google.com',
          custom_alias: 'dashboard',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should reject when rate limit is exceeded with 429 and Retry-After', async () => {
      vi.mocked(shared.checkRateLimitAndQuota).mockResolvedValueOnce({
        allowed: false,
        reason: 'rate_limit',
        currentRate: 6,
        limitRate: 5,
        remainingRate: 0,
        resetRateSeconds: 45,
        currentQuota: 5,
        limitQuota: 20,
        remainingQuota: 15,
        retryAfterSeconds: 45,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/urls',
        payload: {
          original_url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('45');
      const json = response.json();
      expect(json.reason).toBe('rate_limit');
    });
  });

  describe('GET /:code (Redirection Endpoint)', () => {
    it('should return 404 for reserved routes and api prefixes', async () => {
      const resApi = await app.inject({ method: 'GET', url: '/api' });
      expect(resApi.statusCode).toBe(404);

      const resDashboard = await app.inject({ method: 'GET', url: '/dashboard' });
      expect(resDashboard.statusCode).toBe(404);

      const resMetrics = await app.inject({ method: 'GET', url: '/metrics' });
      expect(resMetrics.statusCode).toBe(404);
    });

    it('should redirect 302 Found on Redis cache hit with CDN cache header', async () => {
      vi.mocked(shared.getUrlFromCache).mockResolvedValueOnce('https://example.com/dest');

      const response = await app.inject({
        method: 'GET',
        url: '/mycode',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('https://example.com/dest');
      expect(response.headers['cache-control']).toBe('public, s-maxage=30');
      expect(response.headers['x-server-instance']).toBe('test-node');
    });

    it('should return 404 when code matches negative cache sentinel', async () => {
      vi.mocked(shared.getUrlFromCache).mockResolvedValueOnce('__NOT_FOUND__');

      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toContain('cached');
    });

    it('should return 410 Gone when code matches deactivated sentinel', async () => {
      vi.mocked(shared.getUrlFromCache).mockResolvedValueOnce('__DEACTIVATED__');

      const response = await app.inject({
        method: 'GET',
        url: '/deactivated-link',
      });

      expect(response.statusCode).toBe(410);
      expect(response.json().error).toContain('deactivated or expired');
    });
  });
});
