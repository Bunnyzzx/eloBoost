/**
 * Serviço da Engine de Limpeza.
 *
 * Toda a derivação vive aqui; a tela recebe valores prontos. O backend é a fonte
 * de verdade dos números e das regras — este arquivo só decide como apresentá-los.
 */

import {
  cleanPreviewSchema,
  cleanProgressSchema,
  cleanReportSchema,
  categoryCleanResultSchema,
  historyListSchema,
} from '@/schemas/cleaner';
import { invokeCommand, subscribeToEvent, type Unsubscribe } from '@/services/ipc';
import type {
  CategoryCleanResult,
  CategoryPreview,
  CleanOutcome,
  CleanPreview,
  CleanProgress,
  CleanReport,
  CleanStatus,
  HistoryEntry,
} from '@/types/cleaner';
import { isSelectable, totalCleanSkips } from '@/types/cleaner';
import type { ScanCategoryId } from '@/types/scanner';
import type { StatusTone } from '@/utils/status';

/** Evento com o estado final (ou inicial) de uma categoria. */
const CATEGORY_EVENT = 'cleaner://category';
/** Evento de avanço dentro de uma categoria. */
const PROGRESS_EVENT = 'cleaner://progress';

/**
 * Monta a prévia da limpeza. **Somente leitura.**
 *
 * Devolve, junto dos números, o par que `executeClean` vai exigir.
 */
export async function previewClean(): Promise<CleanPreview> {
  return invokeCommand('cleaner_preview', cleanPreviewSchema);
}

/**
 * Executa a limpeza das categorias confirmadas.
 *
 * O par prévia + token vem de [`previewClean`] e é de uso único. Chamar duas
 * vezes com o mesmo par é recusado pelo backend, o que torna um duplo clique
 * inofensivo.
 */
export async function executeClean(
  preview: Pick<CleanPreview, 'previewId' | 'confirmationToken'>,
  categories: readonly ScanCategoryId[],
): Promise<CleanReport> {
  return invokeCommand('cleaner_execute', cleanReportSchema, {
    previewId: preview.previewId,
    confirmationToken: preview.confirmationToken,
    categories: [...categories],
  });
}

/** Assina o estado das categorias durante a limpeza. */
export function onCategoryCleaned(handler: (result: CategoryCleanResult) => void): Unsubscribe {
  return subscribeToEvent(CATEGORY_EVENT, categoryCleanResultSchema, handler);
}

/** Assina o avanço parcial dentro de uma categoria. */
export function onCleanProgress(handler: (progress: CleanProgress) => void): Unsubscribe {
  return subscribeToEvent(PROGRESS_EVENT, cleanProgressSchema, handler);
}

/** Lê o histórico de operações. Informativo — não existe reversão. */
export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  return invokeCommand('history_list_recent', historyListSchema, { limit });
}

/**
 * Seleção inicial da tela.
 *
 * Marca tudo o que é selecionável. Áreas pessoais nunca entram — nem aqui nem
 * em nenhum outro caminho: o backend também as recusa.
 */
export function defaultSelection(preview: CleanPreview): Set<ScanCategoryId> {
  return new Set(preview.categories.filter(isSelectable).map((item) => item.category));
}

/** Soma o que seria removido pela seleção atual. */
export function selectionTotals(
  preview: CleanPreview,
  selected: ReadonlySet<ScanCategoryId>,
): { bytes: number; files: number; categories: number } {
  let bytes = 0;
  let files = 0;
  let categories = 0;

  for (const item of preview.categories) {
    if (!isSelectable(item) || !selected.has(item.category)) continue;
    bytes += item.sizeBytes;
    files += item.fileCount;
    categories += 1;
  }

  return { bytes, files, categories };
}

/** Rótulo curto da elegibilidade, exibido quando a categoria não é selecionável. */
export function labelForEligibility(preview: CategoryPreview): string | null {
  switch (preview.eligibility) {
    case 'selectable':
      return null;
    case 'read_only_area':
      return 'Somente medido';
    case 'empty':
      return 'Já está limpa';
    case 'unavailable':
      return 'Indisponível';
  }
}

/** Tom visual do estado de uma categoria durante a limpeza. */
export function toneForCleanStatus(status: CleanStatus): StatusTone {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'partially_completed':
      return 'attention';
    case 'failed':
      return 'critical';
    case 'running':
      return 'info';
    case 'pending':
    case 'skipped':
      return 'unknown';
  }
}

/** Rótulo do estado de uma categoria. */
export function labelForCleanStatus(status: CleanStatus): string {
  switch (status) {
    case 'pending':
      return 'Aguardando';
    case 'running':
      return 'Limpando';
    case 'completed':
      return 'Concluído';
    case 'partially_completed':
      return 'Concluído em parte';
    case 'failed':
      return 'Falhou';
    case 'skipped':
      return 'Não selecionado';
  }
}

/** Frase que resume o desfecho da limpeza inteira. */
export function headlineForOutcome(outcome: CleanOutcome): string {
  switch (outcome) {
    case 'success':
      return 'Limpeza concluída';
    case 'partial':
      return 'Limpeza concluída em parte';
    case 'failed':
      return 'Não foi possível limpar';
  }
}

/** Tom do resumo final. */
export function toneForOutcome(outcome: CleanOutcome): StatusTone {
  switch (outcome) {
    case 'success':
      return 'ok';
    case 'partial':
      return 'attention';
    case 'failed':
      return 'critical';
  }
}

/** Quantos itens ficaram para trás numa categoria. */
export function skippedCount(result: CategoryCleanResult): number {
  return totalCleanSkips(result.skipped);
}

/**
 * Progresso de 0 a 100, por categorias concluídas.
 *
 * Como no scanner, contar bytes seria uma estimativa: o tamanho real só se
 * confirma quando o arquivo sai do disco.
 */
export function cleanProgressPercent(finished: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((finished / total) * 100));
}

/** Formata uma duração de limpeza: "1,4 s" ou "820 ms". */
export function formatCleanDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '—';
  if (durationMs < 1000) return `${Math.round(durationMs).toLocaleString('pt-BR')} ms`;

  return `${(durationMs / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} s`;
}

/** Tom de uma entrada do histórico. */
export function toneForHistoryResult(result: string): StatusTone {
  switch (result) {
    case 'success':
      return 'ok';
    case 'partial':
      return 'attention';
    case 'failed':
      return 'critical';
    default:
      return 'unknown';
  }
}
