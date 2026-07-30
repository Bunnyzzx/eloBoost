import { DURATION, EASE } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/utils/cn';

export type ProgressTone = 'accent' | 'ok' | 'attention' | 'critical';

export interface ProgressBarProps {
  /** Valor atual. `null` = progresso indeterminado. */
  value: number | null;
  max?: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  /** Rótulo acessível — obrigatório, já que a barra é puramente visual. */
  label: string;
  className?: string;
}

const TONES: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  attention: 'bg-attention',
  critical: 'bg-critical',
};

/**
 * Barra de progresso.
 *
 * A largura é animada por transição CSS, que **só dispara quando o valor muda**
 * — uma barra parada não custa nada em CPU nem em GPU. Isso importa num app que
 * exibirá vários indicadores ao mesmo tempo na tela de monitoramento.
 *
 * O modo indeterminado (`value = null`) é o único caso com animação contínua, e
 * existe apenas para operações cujo total é genuinamente desconhecido — nunca
 * como enfeite.
 */
export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  size = 'md',
  label,
  className,
}: ProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const indeterminate = value == null;

  const percent = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuetext={indeterminate ? 'Em andamento' : `${Math.round(percent)}%`}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-elevated',
        size === 'sm' ? 'h-1' : 'h-2',
        className,
      )}
    >
      {indeterminate ? (
        <div
          className={cn(
            'absolute inset-y-0 w-1/3 rounded-full',
            TONES[tone],
            // A animação indeterminada é a única contínua do design system.
            reduceMotion ? 'left-0 w-full opacity-60' : 'elo-indeterminate',
          )}
        />
      ) : (
        <div
          className={cn('h-full rounded-full', TONES[tone])}
          style={{
            width: `${percent}%`,
            transition: reduceMotion
              ? undefined
              : `width ${DURATION.slow}ms cubic-bezier(${EASE.join(',')})`,
          }}
        />
      )}
    </div>
  );
}
