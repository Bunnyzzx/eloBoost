/**
 * Contratos da análise do computador.
 *
 * Espelham `src-tauri/src/models/scan_*.rs`. Todos os tamanhos chegam em
 * **bytes** e as durações em **milissegundos** — a formatação acontece só em
 * `utils/format`.
 *
 * O scanner é **somente leitura**: nenhum tipo aqui representa uma ação sobre o
 * disco. `removalPolicy` descreve o que *poderá* ser feito num Épico futuro, e
 * existe justamente para a interface não oferecer o que não deve.
 */

/** Áreas conhecidas do sistema, na ordem de exibição. */
export const SCAN_CATEGORIES = [
  'user_temp',
  'windows_temp',
  'recycle_bin',
  'thumbnails',
  'logs',
  'browser_cache',
  'downloads',
] as const;

export type ScanCategoryId = (typeof SCAN_CATEGORIES)[number];

/** Como terminou a análise de uma categoria. */
export const SCAN_STATUSES = [
  'completed',
  'completed_with_warnings',
  'not_found',
  'not_supported',
  'failed',
] as const;

export type ScanStatus = (typeof SCAN_STATUSES)[number];

/**
 * O que poderá ser feito com a categoria numa etapa futura.
 *
 * `manual_selection_only` marca as áreas que contêm arquivos do usuário: a
 * interface nunca as apresenta como "espaço recuperável" nem oferece seleção em
 * lote sobre elas.
 */
export type RemovalPolicy = 'cleanable' | 'manual_selection_only';

/** Contadores do que a varredura ignorou pelo caminho. Nunca caminhos. */
export interface SkippedItems {
  accessDenied: number;
  pathTooLong: number;
  inUse: number;
  links: number;
  depthExceeded: number;
  readErrors: number;
}

/** Resultado da análise de uma categoria. */
export interface CategoryScan {
  category: ScanCategoryId;
  name: string;
  description: string;
  removalPolicy: RemovalPolicy;
  fileCount: number;
  folderCount: number;
  sizeBytes: number;
  durationMs: number;
  status: ScanStatus;
  message: string | null;
  skipped: SkippedItems;
}

/** Resumo de uma análise completa. */
export interface ScanSummary {
  scanId: string;
  categories: CategoryScan[];
  /** Espaço que poderia ser liberado — **não** inclui Downloads. */
  reclaimableBytes: number;
  /** Tudo o que foi medido, incluindo Downloads. */
  measuredBytes: number;
  totalFiles: number;
  totalFolders: number;
  durationMs: number;
  measuredCategories: number;
  finishedAt: string;
}

/** `true` quando os números desta categoria podem ser somados ao total. */
export function hasMeasurement(status: ScanStatus): boolean {
  return status === 'completed' || status === 'completed_with_warnings';
}

/** Total de itens ignorados, somando todos os motivos. */
export function totalSkipped(skipped: SkippedItems): number {
  return (
    skipped.accessDenied +
    skipped.pathTooLong +
    skipped.inUse +
    skipped.links +
    skipped.depthExceeded +
    skipped.readErrors
  );
}
