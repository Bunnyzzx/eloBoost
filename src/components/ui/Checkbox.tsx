import { Check, Minus } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface CheckboxProps {
  checked: boolean;
  /** Estado parcial: alguns itens marcados, outros não. */
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Explica por que o item está desabilitado, para leitores de tela. */
  disabledReason?: string;
  className?: string;
}

/**
 * Caixa de seleção acessível.
 *
 * O `Toggle` existente comunica "ligado/desligado" de uma preferência; seleção
 * de itens numa lista é outra coisa, e usar `role="switch"` para ela seria
 * anunciado errado por leitores de tela. Daí um componente próprio, com
 * `role="checkbox"` e suporte a estado indeterminado — necessário para o
 * "marcar tudo" quando a seleção é parcial.
 *
 * A área clicável cobre o rótulo inteiro: numa lista de categorias, exigir
 * pontaria no quadradinho de 16 px seria hostil.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  disabledReason,
  className,
}: CheckboxProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-labelledby={labelId}
      aria-describedby={description != null ? descriptionId : undefined}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex w-full items-start gap-3 rounded-[10px] text-left',
        'transition-colors duration-(--elo-duration-instant) ease-elo',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border',
          'transition-colors duration-(--elo-duration-instant) ease-elo',
          checked || indeterminate
            ? 'border-accent bg-accent text-white'
            : 'border-strong bg-elevated',
        )}
      >
        {indeterminate ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          checked && <Check className="size-3" strokeWidth={3} />
        )}
      </span>

      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-medium text-fg">
          {label}
        </span>
        {description != null && (
          <span id={descriptionId} className="mt-0.5 block text-[0.75rem] text-fg-muted">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
