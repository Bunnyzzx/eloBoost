import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card } from '@/components/ui/Card';
import { ProgressBar, type ProgressTone } from '@/components/ui/ProgressBar';
import { Skeleton, SkeletonMeter } from '@/components/ui/Skeleton';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import { toneForUsage } from '@/utils/status';

export interface ProgressCardProps {
  icon: LucideIcon;
  label: string;
  /** Percentual de uso, 0–100. `null` marca a métrica como indisponível. */
  percent: number | null;
  /** Valor principal já formatado — ex.: "9,4 / 16 GB". */
  value?: ReactNode;
  /** Linha secundária. */
  detail?: ReactNode;
  /** Rótulo do que sobra — ex.: "6,6 GB livres". */
  remaining?: ReactNode;
  unavailableText?: string;
  loading?: boolean;
  /** Limiares de atenção e crítico. */
  thresholds?: { attention: number; critical: number };
  className?: string;
}

/** Mapeia o tom de estado para o tom da barra. */
const BAR_TONE: Record<string, ProgressTone> = {
  ok: 'accent',
  attention: 'attention',
  critical: 'critical',
};

/**
 * Card de uso com barra de progresso — memória, disco, CPU.
 *
 * O percentual é sempre exibido como texto ao lado da barra: a barra é reforço
 * visual, não a única forma de ler o dado (docs/08 §6).
 *
 * A barra só anima quando o valor muda, então vários cards parados na tela não
 * custam nada.
 */
export function ProgressCard({
  icon: Icon,
  label,
  percent,
  value,
  detail,
  remaining,
  unavailableText = 'Informação não suportada neste dispositivo.',
  loading = false,
  thresholds,
  className,
}: ProgressCardProps) {
  const tone = percent == null ? 'unknown' : toneForUsage(percent, thresholds);
  const barTone = BAR_TONE[tone] ?? 'accent';

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-fg-secondary">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent-soft text-accent"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <span className="truncate">{label}</span>
        </span>

        {!loading && percent != null && (tone === 'attention' || tone === 'critical') && (
          <StatusBadge
            tone={tone}
            hint={
              tone === 'critical'
                ? 'Uso muito alto: pode afetar o desempenho.'
                : 'Uso elevado — vale acompanhar.'
            }
          >
            {tone === 'critical' ? 'Crítico' : 'Atenção'}
          </StatusBadge>
        )}
      </div>

      {loading ? (
        <div className="mt-3">
          <Skeleton className="h-7 w-28" label={`Carregando ${label}`} />
          <SkeletonMeter className="mt-3" />
        </div>
      ) : percent == null ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-fg-muted italic">
          {unavailableText}
        </p>
      ) : (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            {/* Corpo menor que o do StatCard: aqui o valor divide a linha com o
                percentual, e "1,4 GB / 15,7 GB" não caberia em text-xl. */}
            <p
              className="truncate text-lg font-semibold tracking-tight text-fg tabular"
              data-numeric
            >
              {value ?? formatPercent(percent)}
            </p>
            <p
              className="shrink-0 text-[0.8125rem] font-medium text-fg-secondary tabular"
              data-numeric
            >
              {formatPercent(percent)}
            </p>
          </div>

          <ProgressBar
            value={percent}
            tone={barTone}
            label={`Uso de ${label}`}
            className="mt-2.5"
          />

          <div className="mt-2 flex items-baseline justify-between gap-3 text-[0.75rem] text-fg-muted">
            {detail != null ? <span className="truncate">{detail}</span> : <span />}
            {remaining != null && (
              <span className="shrink-0 tabular" data-numeric>
                {remaining}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
