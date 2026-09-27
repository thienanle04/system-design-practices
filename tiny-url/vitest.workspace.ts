import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared',
  'apps/url-service',
  'apps/kgs-service',
  'apps/analytics-service',
  'apps/web',
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
    },
  },
]);
