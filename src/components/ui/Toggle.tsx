import { useId } from 'react';

import { cn } from '@/utils/cn';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Esconde o rótulo visualmente, mantendo-o para leitores de tela. */
  hideLabel?: boolean;
  className?: string;
}

/**
 * Interruptor acessível.
 *
 * Usa `role="switch"` num `<button>` real: funciona com Espaço/Enter e é
 * anunciado corretamente como ligado/desligado.
 */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  hideLabel = false,
  className,
}: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description != null ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full',
          'border transition-colors duration-150 ease-elo',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-accent bg-accent' : 'border-strong bg-elevated',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-3.5 rounded-full bg-white shadow-elo-sm',
            'transition-transform duration-150 ease-elo',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>

      <span className={cn('min-w-0', hideLabel && 'sr-only')}>
        <span id={labelId} className="block text-sm font-medium text-fg">
          {label}
        </span>
        {description != null && (
          <span id={descriptionId} className="mt-0.5 block text-[0.8125rem] text-fg-secondary">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
