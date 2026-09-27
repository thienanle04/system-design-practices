import { describe, it, expect } from 'vitest';
import {
  createUrlSchema,
  customAliasSchema,
  listUrlsQuerySchema,
  updateUrlSchema,
} from '../utils/validation.js';
import { isReservedShortCode } from '../utils/reserved-codes.js';

describe('Validation Schemas & Reserved Codes', () => {
  describe('Reserved Short Codes', () => {
    it('should identify reserved words case-insensitively', () => {
      expect(isReservedShortCode('dashboard')).toBe(true);
      expect(isReservedShortCode('Dashboard')).toBe(true);
      expect(isReservedShortCode('ADMIN')).toBe(true);
      expect(isReservedShortCode('api')).toBe(true);
      expect(isReservedShortCode('health')).toBe(true);
      expect(isReservedShortCode('metrics')).toBe(true);
      expect(isReservedShortCode('favicon.ico')).toBe(true);
      expect(isReservedShortCode('status')).toBe(true);
    });

    it('should allow non-reserved short codes', () => {
      expect(isReservedShortCode('my-blog')).toBe(false);
      expect(isReservedShortCode('promo2024')).toBe(false);
      expect(isReservedShortCode('xyz1234')).toBe(false);
      expect(isReservedShortCode('')).toBe(false);
    });
  });

  describe('customAliasSchema', () => {
    it('should allow valid alphanumeric aliases with hyphens and underscores', () => {
      expect(customAliasSchema.safeParse('my-link').success).toBe(true);
      expect(customAliasSchema.safeParse('promo_2026').success).toBe(true);
      expect(customAliasSchema.safeParse('abc').success).toBe(true);
    });

    it('should reject aliases shorter than 3 characters', () => {
      const res = customAliasSchema.safeParse('ab');
      expect(res.success).toBe(false);
    });

    it('should reject aliases longer than 30 characters', () => {
      const res = customAliasSchema.safeParse('a'.repeat(31));
      expect(res.success).toBe(false);
    });

    it('should reject aliases with special characters', () => {
      expect(customAliasSchema.safeParse('link!@#').success).toBe(false);
      expect(customAliasSchema.safeParse('hello world').success).toBe(false);
      expect(customAliasSchema.safeParse('path/to').success).toBe(false);
    });

    it('should reject reserved keywords', () => {
      expect(customAliasSchema.safeParse('dashboard').success).toBe(false);
      expect(customAliasSchema.safeParse('admin').success).toBe(false);
      expect(customAliasSchema.safeParse('metrics').success).toBe(false);
    });
  });

  describe('createUrlSchema', () => {
    it('should validate valid URLs', () => {
      const res = createUrlSchema.safeParse({
        original_url: 'https://example.com/some/long/path?param=1',
      });
      expect(res.success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const res = createUrlSchema.safeParse({
        original_url: 'not-a-valid-url',
      });
      expect(res.success).toBe(false);
    });

    it('should accept valid expires_in_days', () => {
      const res = createUrlSchema.safeParse({
        original_url: 'https://example.com',
        expires_in_days: 7,
      });
      expect(res.success).toBe(true);
    });

    it('should reject negative or zero expires_in_days', () => {
      expect(
        createUrlSchema.safeParse({
          original_url: 'https://example.com',
          expires_in_days: 0,
        }).success
      ).toBe(false);

      expect(
        createUrlSchema.safeParse({
          original_url: 'https://example.com',
          expires_in_days: -5,
        }).success
      ).toBe(false);
    });
  });

  describe('listUrlsQuerySchema', () => {
    it('should provide default values for pagination', () => {
      const res = listUrlsQuerySchema.parse({});
      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.status).toBe('all');
    });

    it('should coerce string numbers to integers', () => {
      const res = listUrlsQuerySchema.parse({
        page: '3',
        limit: '25',
        status: 'active',
      });
      expect(res.page).toBe(3);
      expect(res.limit).toBe(25);
      expect(res.status).toBe('active');
    });
  });
});
