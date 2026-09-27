export const RESERVED_SHORT_CODES = new Set<string>([
  'dashboard',
  'admin',
  'api',
  'health',
  'metrics',
  'static',
  'assets',
  'favicon.ico',
  'r',
  'docs',
  'status',
]);

export function isReservedShortCode(code: string): boolean {
  if (!code) return false;
  return RESERVED_SHORT_CODES.has(code.trim().toLowerCase());
}
