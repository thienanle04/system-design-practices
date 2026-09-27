import { describe, it, expect } from 'vitest';
import { RATE_LIMIT_TIERS } from '../redis/index.js';

describe('Rate Limit Tier Configuration (ADR-0010)', () => {
  it('should define correct rate limits and quotas for guest tier', () => {
    expect(RATE_LIMIT_TIERS.guest).toBeDefined();
    expect(RATE_LIMIT_TIERS.guest.rateLimitPerMinute).toBe(5);
    expect(RATE_LIMIT_TIERS.guest.dailyQuota).toBe(20);
  });

  it('should define correct rate limits and quotas for free tier', () => {
    expect(RATE_LIMIT_TIERS.free).toBeDefined();
    expect(RATE_LIMIT_TIERS.free.rateLimitPerMinute).toBe(30);
    expect(RATE_LIMIT_TIERS.free.dailyQuota).toBe(500);
  });

  it('should define correct rate limits and quotas for paid tier', () => {
    expect(RATE_LIMIT_TIERS.paid).toBeDefined();
    expect(RATE_LIMIT_TIERS.paid.rateLimitPerMinute).toBe(300);
    expect(RATE_LIMIT_TIERS.paid.dailyQuota).toBe(50000);
  });

  it('each tier should have strictly increasing limits', () => {
    expect(RATE_LIMIT_TIERS.free.rateLimitPerMinute).toBeGreaterThan(RATE_LIMIT_TIERS.guest.rateLimitPerMinute);
    expect(RATE_LIMIT_TIERS.paid.rateLimitPerMinute).toBeGreaterThan(RATE_LIMIT_TIERS.free.rateLimitPerMinute);

    expect(RATE_LIMIT_TIERS.free.dailyQuota).toBeGreaterThan(RATE_LIMIT_TIERS.guest.dailyQuota);
    expect(RATE_LIMIT_TIERS.paid.dailyQuota).toBeGreaterThan(RATE_LIMIT_TIERS.free.dailyQuota);
  });
});
