/**
 * Validadores Zod da Engine de Limpeza.
 *
 * Mesma regra dos demais: nada renderiza sem passar por aqui, inclusive as
 * cargas dos eventos de progresso — que não passam pelo `invokeCommand`.
 */

import { z } from 'zod';

import { skippedItemsSchema, scanCategoryIdSchema } from '@/schemas/scanner';
import { CLEAN_ELIGIBILITIES, CLEAN_OUTCOMES, CLEAN_STATUSES } from '@/types/cleaner';

export const cleanEligibilitySchema = z.enum(CLEAN_ELIGIBILITIES);
export const cleanStatusSchema = z.enum(CLEAN_STATUSES);
export const cleanOutcomeSchema = z.enum(CLEAN_OUTCOMES);

const counterSchema = z.number().int().nonnegative();

export const cleanSkipsSchema = z.object({
  accessDenied: counterSchema,
  inUse: counterSchema,
  pathTooLong: counterSchema,
  alreadyGone: counterSchema,
  links: counterSchema,
  rejectedByGuard: counterSchema,
  otherFailures: counterSchema,
});

export const categoryPreviewSchema = z.object({
  category: scanCategoryIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  eligibility: cleanEligibilitySchema,
  note: z.string().nullable(),
  fileCount: counterSchema,
  folderCount: counterSchema,
  sizeBytes: counterSchema,
  skipped: skippedItemsSchema,
});

export const cleanPreviewSchema = z.object({
  previewId: z.string().min(1),
  confirmationToken: z.string().min(1),
  categories: z.array(categoryPreviewSchema),
  removableBytes: counterSchema,
  removableFiles: counterSchema,
  selectableCategories: counterSchema,
  durationMs: counterSchema,
  createdAt: z.string().min(1),
});

export const categoryCleanResultSchema = z.object({
  category: scanCategoryIdSchema,
  name: z.string().min(1),
  status: cleanStatusSchema,
  removedFiles: counterSchema,
  removedFolders: counterSchema,
  freedBytes: counterSchema,
  skipped: cleanSkipsSchema,
  durationMs: counterSchema,
  message: z.string().nullable(),
});

export const cleanReportSchema = z.object({
  operationId: z.string().min(1),
  outcome: cleanOutcomeSchema,
  categories: z.array(categoryCleanResultSchema),
  freedBytes: counterSchema,
  removedFiles: counterSchema,
  removedFolders: counterSchema,
  skipped: cleanSkipsSchema,
  executedCategories: counterSchema,
  durationMs: counterSchema,
  finishedAt: z.string().min(1),
});

export const cleanProgressSchema = z.object({
  category: scanCategoryIdSchema,
  removedFiles: counterSchema,
  freedBytes: counterSchema,
});

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  actionType: z.string().min(1),
  message: z.string().min(1),
  result: z.string().min(1),
  affectedCount: counterSchema,
  releasedBytes: counterSchema,
  createdAt: z.string().min(1),
  details: z.string().nullable(),
});

export const historyListSchema = z.array(historyEntrySchema);
