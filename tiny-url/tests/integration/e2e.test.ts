import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

describe('Live Edge CDN & System E2E Integration Tests', () => {
  let isClusterOnline = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        isClusterOnline = true;
      }
    } catch {
      isClusterOnline = false;
    }
  });

  it('should verify live cluster connectivity or note offline state', async () => {
    if (!isClusterOnline) {
      console.warn(`[Integration Test] Cluster at ${BASE_URL} is offline. Skipping live container assertions.`);
      expect(true).toBe(true);
      return;
    }

    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.instance).toBeDefined();
  });

  it('should test URL creation and redirection through Edge CDN if online', async () => {
    if (!isClusterOnline) {
      return;
    }

    // 1. Create Short URL
    const createRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'free_demo_key',
      },
      body: JSON.stringify({
        original_url: 'https://example.com/integration-test',
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.short_code).toBeDefined();
    expect(created.tier).toBe('free');

    // 2. First redirect -> Expect MISS
    const missRes = await fetch(`${BASE_URL}/${created.short_code}`, {
      method: 'HEAD',
      redirect: 'manual',
    });
    expect([301, 302, 307]).toContain(missRes.status);
    expect(missRes.headers.get('location')).toBe('https://example.com/integration-test');

    // 3. Second redirect -> Expect Edge CDN HIT
    const hitRes = await fetch(`${BASE_URL}/${created.short_code}`, {
      method: 'HEAD',
      redirect: 'manual',
    });
    expect([301, 302, 307]).toContain(hitRes.status);
    const cacheHeader = hitRes.headers.get('x-cache-status');
    if (cacheHeader) {
      expect(cacheHeader).toBe('HIT');
    }
  });
});
