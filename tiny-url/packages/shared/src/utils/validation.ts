import { z } from 'zod';
import { isReservedShortCode } from './reserved-codes.js';

export const customAliasSchema = z
  .string()
  .min(3, 'Custom alias must be at least 3 characters')
  .max(30, 'Custom alias must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Custom alias can only contain alphanumeric characters, hyphens, and underscores')
  .refine((val) => !isReservedShortCode(val), {
    message: 'This alias is reserved by the system',
  });

export const createUrlSchema = z.object({
  original_url: z.string().url('Invalid URL format. Must start with http:// or https://'),
  custom_alias: customAliasSchema.optional(),
  expires_in_days: z.number().int().positive().optional(),
});

export const listUrlsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'expired', 'deactivated']).default('all'),
});

export const updateUrlSchema = z.object({
  is_active: z.boolean().optional(),
  expires_at: z.string().nullable().optional(),
});
