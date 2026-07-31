/**
 * Serviço da análise do computador.
 *
 * Toda a derivação vive aqui — a tela recebe valores prontos. O backend é a
 * fonte de verdade dos números; este arquivo só decide como apresentá-los.
 *
 * **Somente leitura.** Não existe nenhuma função de limpeza, remoção ou
 * alteração: o Épico 2 termina na medição.
 */

import { categoryListSchema, categoryScanSchema, scanSummarySchema } from '@/schemas/scanner';
import { invokeCommand, subscribeToEvent, type Unsubscribe } from '@/services/ipc';
import type { CategoryScan, ScanStatus, ScanSummary } from '@/types/scanner';
import { hasMeasurement, totalSkipped } from '@/types/scanner';
import type { StatusTone } from '@/utils/status';

/** Evento emitido pelo backend a cada categoria concluída. */
const CATEGORY_EVENT = 'scanner://category';

/**
 * Lista as áreas que o scanner conhece, sem analisar nada.
 *
 * A tela desenha os cards a partir daqui antes de a varredura começar, com os
 * nomes e as descrições do backend — não há um segundo dicionário na interface.
 */
export async function listScanCategories(): Promise<CategoryScan[]> {
  return invokeCommand('scanner_list_categories', categoryListSchema);
}

/**
 * Executa a análise completa.
 *
 * O valor devolvido é o relatório definitivo. O progresso por categoria chega
 * por [`onCategoryScanned`], que existe para a tela preencher os cards conforme
 * chegam — nunca como fonte do resultado final.
 */
export async function scanComputer(): Promise<ScanSummary> {
  return invokeCommand('scanner_scan_all', scanSummarySchema);
}

/**
 * Assina o progresso da análise: uma chamada por categoria concluída.
 *
 * Devolve a função de cancelamento, que o efeito do React chama na limpeza.
 */
export function onCategoryScanned(handler: (scan: CategoryScan) => void): Unsubscribe {
  return subscribeToEvent(CATEGORY_EVENT, categoryScanSchema, handler);
}

/**
 * Tom visual de um resultado.
 *
 * Regra de produto: uma área que não existe nesta máquina **não é um problema**.
 * Ela aparece em tom neutro, não em vermelho — o usuário não precisa se
 * preocupar por não ter cache do Firefox.
 */
export function toneForStatus(status: ScanStatus): StatusTone {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'completed_with_warnings':
      return 'attention';
    case 'failed':
      return 'critical';
    case 'not_found':
    case 'not_supported':
      return 'unknown';
  }
}

/** Rótulo curto do estado, exibido no selo de cada card. */
export function labelForStatus(status: ScanStatus): string {
  switch (status) {
    case 'completed':
      return 'Analisado';
    case 'completed_with_warnings':
      return 'Analisado em parte';
    case 'failed':
      return 'Não analisado';
    case 'not_found':
      return 'Não existe aqui';
    case 'not_supported':
      return 'Indisponível';
  }
}

/**
 * Frase que a tela exibe abaixo dos números de uma categoria.
 *
 * O backend já manda a explicação quando há uma; esta função cobre o caso
 * comum — análise limpa — sem obrigar o Rust a produzir texto para tudo.
 */
export function detailForScan(scan: CategoryScan): string | null {
  if (scan.message != null) return scan.message;
  if (!hasMeasurement(scan.status)) return null;
  if (scan.fileCount === 0) return 'Nada encontrado nesta área.';
  return null;
}

/** `true` quando a categoria contém arquivos do usuário e nunca é limpa em lote. */
export function isPersonalArea(scan: CategoryScan): boolean {
  return scan.removalPolicy === 'manual_selection_only';
}

/** Quantos itens a análise ignorou nesta categoria. */
export function skippedCount(scan: CategoryScan): number {
  return totalSkipped(scan.skipped);
}

/**
 * Progresso de 0 a 100, a partir de quantas categorias já responderam.
 *
 * Um percentual por bytes seria mais bonito e mentiroso: não há como saber o
 * tamanho total antes de percorrer. Contar categorias é o único progresso
 * honesto que o scanner consegue oferecer.
 */
export function scanProgress(finished: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((finished / total) * 100));
}

/** Formata a duração de uma análise: "1,4 s" ou "820 ms". */
export function formatScanDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '—';
  if (durationMs < 1000) return `${Math.round(durationMs).toLocaleString('pt-BR')} ms`;

  return `${(durationMs / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} s`;
}
