import type { ReactNode } from 'react';

import { ProgressBar, type ProgressTone } from '@/components/ui/ProgressBar';
import { cn } from '@/utils/cn';

export interface MeterProps {
  label: string;
  /** Valor atual. `null` quando a métrica não está disponível no dispositivo. */
  value: number | null;
  max?: number;
  /** Texto do valor já formatado — ex.: "9,4 / 16 GB", "23%". */
  displayValue?: ReactNode;
  icon?: ReactNode;
  /** Limiares de atenção e crítico, em percentual do máximo. */
  thresholds?: { attention: number; critical: number };
  /** Mensagem exibida quando `value` é `null`. */
  unavailableText?: string;
  className?: string;
}

/**
 * Indicador de recurso — CPU, memória, disco, rede.
 *
 * Criado agora para que os Épicos 1 e 12 apenas o consumam, em vez de cada tela
 * inventar sua própria barra. Duas regras do produto embutidas:
 *
 * • **`value = null` não vira zero.** Uma métrica indisponível exibe texto
 *   explícito, nunca uma barra vazia que o usuário leria como "0%".
 * • **A cor nunca é o único sinal.** O valor aparece sempre como texto ao lado,
 *   e o estado crítico ganha rótulo textual.
 */
export function Meter({
  label,
  value,
  max = 100,
  displayValue,
  icon,
  thresholds = { attention: 75, critical: 90 },
  unavailableText = 'Informação não suportada neste dispositivo.',
  className,
}: MeterProps) {
  const unavailable = value == null;
  const percent = unavailable ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  let tone: ProgressTone = 'accent';
  let statusLabel: string | null = null;
  if (!unavailable) {
    if (percent >= thresholds.critical) {
      tone = 'critical';
      statusLabel = 'crítico';
    } else if (percent >= thresholds.attention) {
      tone = 'attention';
      statusLabel = 'atenção';
    }
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-fg-secondary">
          {icon != null && (
            <span aria-hidden className="shrink-0">
              {icon}
            </span>
          )}
          <span className="truncate">{label}</span>
        </span>

        {!unavailable && (
          <span className="shrink-0 text-sm font-medium text-fg tabular" data-numeric>
            {displayValue ?? `${Math.round(percent)}%`}
            {statusLabel != null && (
              <span
                className={cn(
                  'ml-1.5 text-[0.6875rem] font-normal',
                  tone === 'critical' ? 'text-critical' : 'text-attention',
                )}
              >
                {statusLabel}
              </span>
            )}
          </span>
        )}
      </div>

      {unavailable ? (
        <p className="mt-1.5 text-[0.75rem] text-fg-muted">{unavailableText}</p>
      ) : (
        <ProgressBar value={value} max={max} tone={tone} size="sm" label={label} className="mt-2" />
      )}
    </div>
  );
}
