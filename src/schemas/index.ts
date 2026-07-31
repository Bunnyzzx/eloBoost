/**
 * Validadores Zod das respostas do backend.
 *
 * Regra da arquitetura (docs/01 §5): toda resposta do backend é validada aqui
 * antes de chegar às stores e páginas. Se o contrato Rust divergir do contrato
 * TypeScript, o erro aparece neste ponto — com mensagem legível — em vez de
 * virar `undefined` propagado silenciosamente pela interface.
 */

import { z } from 'zod';

import { ERROR_CODES } from '@/types/errors';

export const errorCodeSchema = z.enum(ERROR_CODES);

export const operationErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  technicalDetails: z.string().nullable(),
  suggestion: z.string().nullable(),
  retryable: z.boolean(),
  diagnosticId: z.string(),
  context: z.record(z.string(), z.string()).optional(),
});

export const riskLevelSchema = z.enum(['low', 'medium', 'high']);

export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildProfile: z.string(),
  runningInTauri: z.boolean(),
});

export const appliedMigrationSchema = z.object({
  version: z.number().int().nonnegative(),
  name: z.string(),
  appliedAt: z.string(),
});

export const databaseStatusSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
  appliedMigrations: z.array(appliedMigrationSchema),
  databasePathMasked: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  healthy: z.boolean(),
});

export function pagedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  });
}
