/**
 * Contratos da Engine de Limpeza.
 *
 * Espelham `src-tauri/src/models/clean_*.rs`. Tamanhos em **bytes**, durações
 * em **milissegundos**.
 *
 * Nota de desenho: `previewId` + `confirmationToken` não são detalhe de
 * implementação — são a prova, exigida pelo backend, de que o usuário viu o que
 * seria removido. Sem esse par não existe execução.
 */

import type { ScanCategoryId, SkippedItems } from '@/types/scanner';

/** Se a categoria pode entrar numa limpeza, e por que não quando não pode. */
export const CLEAN_ELIGIBILITIES = [
  'selectable',
  'read_only_area',
  'empty',
  'unavailable',
] as const;

export type CleanEligibility = (typeof CLEAN_ELIGIBILITIES)[number];

/** Estado de uma categoria durante e depois da limpeza. */
export const CLEAN_STATUSES = [
  'pending',
  'running',
  'completed',
  'partially_completed',
  'failed',
  'skipped',
] as const;

export type CleanStatus = (typeof CLEAN_STATUSES)[number];

/** Como terminou a limpeza inteira. */
export const CLEAN_OUTCOMES = ['success', 'partial', 'failed'] as const;

export type CleanOutcome = (typeof CLEAN_OUTCOMES)[number];

/** Contadores do que ficou para trás. Nunca caminhos. */
export interface CleanSkips {
  accessDenied: number;
  inUse: number;
  pathTooLong: number;
  alreadyGone: number;
  links: number;
  rejectedByGuard: number;
  otherFailures: number;
}

/** A prévia de uma categoria. */
export interface CategoryPreview {
  category: ScanCategoryId;
  name: string;
  description: string;
  eligibility: CleanEligibility;
  note: string | null;
  fileCount: number;
  folderCount: number;
  sizeBytes: number;
  skipped: SkippedItems;
}

/** A prévia completa. Nada foi removido para produzi-la. */
export interface CleanPreview {
  previewId: string;
  confirmationToken: string;
  categories: CategoryPreview[];
  removableBytes: number;
  removableFiles: number;
  selectableCategories: number;
  durationMs: number;
  createdAt: string;
}

/** O que a limpeza de uma categoria conseguiu fazer. */
export interface CategoryCleanResult {
  category: ScanCategoryId;
  name: string;
  status: CleanStatus;
  removedFiles: number;
  removedFolders: number;
  freedBytes: number;
  skipped: CleanSkips;
  durationMs: number;
  message: string | null;
}

/** O relatório final. */
export interface CleanReport {
  operationId: string;
  outcome: CleanOutcome;
  categories: CategoryCleanResult[];
  freedBytes: number;
  removedFiles: number;
  removedFolders: number;
  skipped: CleanSkips;
  executedCategories: number;
  durationMs: number;
  finishedAt: string;
}

/** Avanço parcial dentro de uma categoria. */
export interface CleanProgress {
  category: ScanCategoryId;
  removedFiles: number;
  freedBytes: number;
}

/** Uma entrada do histórico. Informativa — não existe reversão. */
export interface HistoryEntry {
  id: string;
  operationId: string;
  actionType: string;
  message: string;
  result: string;
  affectedCount: number;
  releasedBytes: number;
  createdAt: string;
  details: string | null;
}

/** `true` quando a categoria pode ser marcada pelo usuário. */
export function isSelectable(preview: CategoryPreview): boolean {
  return preview.eligibility === 'selectable';
}

/** Total de itens que ficaram para trás numa limpeza. */
export function totalCleanSkips(skips: CleanSkips): number {
  return (
    skips.accessDenied +
    skips.inUse +
    skips.pathTooLong +
    skips.alreadyGone +
    skips.links +
    skips.rejectedByGuard +
    skips.otherFailures
  );
}
