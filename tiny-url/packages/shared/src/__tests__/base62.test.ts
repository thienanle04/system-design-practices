import { describe, it, expect } from 'vitest';
import {
  generateRandomBase62Key,
  generateKeysBatch,
  isValidBase62,
  BASE62_CHARS,
  DEFAULT_KEY_LENGTH,
} from '../utils/base62.js';

describe('Base62 Utilities', () => {
  it('should generate a 7-character Base62 key by default', () => {
    const key = generateRandomBase62Key();
    expect(key).toHaveLength(DEFAULT_KEY_LENGTH);
    expect(isValidBase62(key)).toBe(true);
  });

  it('should generate keys of specified length', () => {
    const key5 = generateRandomBase62Key(5);
    const key10 = generateRandomBase62Key(10);
    expect(key5).toHaveLength(5);
    expect(key10).toHaveLength(10);
    expect(isValidBase62(key5)).toBe(true);
    expect(isValidBase62(key10)).toBe(true);
  });

  it('should contain only characters from the Base62 charset', () => {
    for (let i = 0; i < 50; i++) {
      const key = generateRandomBase62Key();
      for (const char of key) {
        expect(BASE62_CHARS.includes(char)).toBe(true);
      }
    }
  });

  it('should generate a batch of unique keys', () => {
    const count = 100;
    const batch = generateKeysBatch(count);
    expect(batch).toHaveLength(count);

    const set = new Set(batch);
    expect(set.size).toBe(count);
  });

  it('should exclude specified reserved keys from batch generation', () => {
    const exclude = new Set(['abc1234', 'def5678']);
    const batch = generateKeysBatch(50, 7, exclude);
    for (const key of batch) {
      expect(exclude.has(key.toLowerCase())).toBe(false);
    }
  });

  it('isValidBase62 should correctly identify valid and invalid strings', () => {
    expect(isValidBase62('0123456789')).toBe(true);
    expect(isValidBase62('abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(isValidBase62('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(true);
    expect(isValidBase62('abc-123')).toBe(false);
    expect(isValidBase62('hello_world')).toBe(false);
    expect(isValidBase62('special!@#')).toBe(false);
    expect(isValidBase62(' spaces ')).toBe(false);
  });
});
