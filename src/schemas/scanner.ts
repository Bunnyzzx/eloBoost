/**
 * Validadores Zod da análise do computador.
 *
 * Mesma regra dos demais schemas: nada renderiza sem passar por aqui. Uma
 * divergência entre o que o Rust serializa e o que a tela espera vira
 * `CONTRACT_MISMATCH` com o caminho do campo — inclusive nos eventos de
 * progresso, que não passam pelo `invokeCommand`.
 */

import { z } from 'zod';

import { SCAN_CATEGORIES, SCAN_STATUSES } from '@/types/scanner';

export const scanCategoryIdSchema = z.enum(SCAN_CATEGORIES);
export const scanStatusSchema = z.enum(SCAN_STATUSES);
export const removalPolicySchema = z.enum(['cleanable', 'manual_selection_only']);

/** Contadores: inteiros não negativos. Nunca caminhos. */
const counterSchema = z.number().int().nonnegative();

export const skippedItemsSchema = z.object({
  accessDenied: counterSchema,
  pathTooLong: counterSchema,
  inUse: counterSchema,
  links: counterSchema,
  depthExceeded: counterSchema,
  readErrors: counterSchema,
});

export const categoryScanSchema = z.object({
  category: scanCategoryIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  removalPolicy: removalPolicySchema,
  fileCount: counterSchema,
  folderCount: counterSchema,
  sizeBytes: counterSchema,
  durationMs: counterSchema,
  status: scanStatusSchema,
  message: z.string().nullable(),
  skipped: skippedItemsSchema,
});

export const scanSummarySchema = z.object({
  scanId: z.string().min(1),
  categories: z.array(categoryScanSchema),
  reclaimableBytes: counterSchema,
  measuredBytes: counterSchema,
  totalFiles: counterSchema,
  totalFolders: counterSchema,
  durationMs: counterSchema,
  measuredCategories: counterSchema,
  finishedAt: z.string().min(1),
});

export const categoryListSchema = z.array(categoryScanSchema);
