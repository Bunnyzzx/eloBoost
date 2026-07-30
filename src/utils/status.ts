/**
 * Vocabulário de estado compartilhado pela interface.
 *
 * Vive fora dos componentes por dois motivos: mantém o Fast Refresh funcionando
 * (um arquivo de componente deve exportar apenas componentes) e deixa claro que
 * os limiares são uma decisão de produto — não detalhe de um card específico.
 */

/**
 * Estados possíveis de um indicador.
 *
 * `unknown` é um estado de primeira classe: quando o backend não conseguiu
 * determinar algo, dizer "desconhecido" é a resposta correta — não "ok".
 */
export type StatusTone = 'ok' | 'attention' | 'critical' | 'info' | 'unknown';

/** Limiares padrão de uso, em percentual. */
export const USAGE_THRESHOLDS = { attention: 75, critical: 90 } as const;

/**
 * Converte um percentual de uso em tom de estado.
 *
 * Centralizado para que disco, memória e CPU usem os mesmos limiares — em vez de
 * cada card inventar o seu, o que faria "atenção" significar coisas diferentes
 * em telas diferentes.
 */
export function toneForUsage(
  percent: number,
  thresholds: { attention: number; critical: number } = USAGE_THRESHOLDS,
): StatusTone {
  if (percent >= thresholds.critical) return 'critical';
  if (percent >= thresholds.attention) return 'attention';
  return 'ok';
}
