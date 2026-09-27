import crypto from 'crypto';

export const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DEFAULT_KEY_LENGTH = 7;

export function generateRandomBase62Key(length: number = DEFAULT_KEY_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }
  return result;
}

export function generateKeysBatch(count: number, length: number = DEFAULT_KEY_LENGTH, excludeSet?: Set<string>): string[] {
  const keySet = new Set<string>();
  while (keySet.size < count) {
    const key = generateRandomBase62Key(length);
    if (excludeSet && excludeSet.has(key.toLowerCase())) {
      continue;
    }
    keySet.add(key);
  }
  return Array.from(keySet);
}

export function isValidBase62(str: string): boolean {
  return /^[0-9a-zA-Z]+$/.test(str);
}
