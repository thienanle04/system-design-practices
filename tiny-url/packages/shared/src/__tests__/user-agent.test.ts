import { describe, it, expect } from 'vitest';
import { parseUserAgentLight } from '../utils/user-agent.js';

describe('User-Agent Parser Light', () => {
  it('should parse Chrome on Windows desktop', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Windows');
    expect(parsed.device).toBe('Desktop');
  });

  it('should parse Edge on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Edge');
    expect(parsed.os).toBe('Windows');
    expect(parsed.device).toBe('Desktop');
  });

  it('should parse Safari on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('macOS');
    expect(parsed.device).toBe('Desktop');
  });

  it('should parse Firefox on Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Firefox');
    expect(parsed.os).toBe('Linux');
    expect(parsed.device).toBe('Desktop');
  });

  it('should parse Chrome on Android Mobile', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Android');
    expect(parsed.device).toBe('Mobile');
  });

  it('should parse Safari on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
    expect(parsed.device).toBe('Mobile');
  });

  it('should parse Safari on iPad', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.os).toBe('iOS');
    expect(parsed.device).toBe('Tablet');
  });

  it('should parse cURL requests', () => {
    const ua = 'curl/8.4.0';
    const parsed = parseUserAgentLight(ua);
    expect(parsed.browser).toBe('cURL');
  });

  it('should fallback to Unknown for empty or unrecognized User-Agent', () => {
    const parsed = parseUserAgentLight('');
    expect(parsed.browser).toBe('Unknown');
    expect(parsed.os).toBe('Unknown');
    expect(parsed.device).toBe('Desktop');
  });
});
