import { HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip } from '@/components/ui/Tooltip';
import type { Availability } from '@/types/system';
import { cn } from '@/utils/cn';

export interface InfoRowProps {
  label: string;
  /**
   * Valor a exibir. Aceita `Availability<T>` diretamente: quando indisponível,
   * a linha mostra o motivo em tom apagado, em vez de um campo vazio.
   */
  value: Availability<ReactNode> | ReactNode;
  /** Explicação do termo técnico, em tooltip acessível. */
  hint?: string;
  /** Permite selecionar o valor — para caminhos, versões e identificadores. */
  selectable?: boolean;
  /** Alinha números com largura fixa, evitando "dança" ao atualizar. */
  numeric?: boolean;
  className?: string;
}

/** Distingue um `Availability` de um `ReactNode` qualquer. */
function isAvailability(value: unknown): value is Availability<ReactNode> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value.status === 'available' || value.status === 'unavailable')
  );
}

/**
 * Linha de dado rotulado — o átomo dos cards de informação.
 *
 * Trata `Availability` de forma consistente em todo o aplicativo: um campo que
 * o backend não conseguiu ler exibe a frase do motivo, nunca um traço ambíguo
 * nem um zero que passaria por dado real.
 */
export function InfoRow({
  label,
  value,
  hint,
  selectable = false,
  numeric = false,
  className,
}: InfoRowProps) {
  const unavailableMessage =
    isAvailability(value) && value.status === 'unavailable' ? value.message : null;
  const content = isAvailability(value)
    ? value.status === 'available'
      ? value.value
      : null
    : value;

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-subtle py-2 last:border-0',
        className,
      )}
    >
      <dt className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] text-fg-muted">
        {label}
        {hint != null && (
          <Tooltip content={hint} side="right">
            <button
              type="button"
              aria-label={`O que é ${label}`}
              className="grid place-items-center rounded-full text-fg-muted transition-colors hover:text-fg-secondary"
            >
              <HelpCircle aria-hidden className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </dt>

      <dd
        className={cn(
          'min-w-0 text-right text-[0.8125rem]',
          unavailableMessage != null ? 'text-fg-muted italic' : 'font-medium text-fg',
          selectable && 'selectable',
          numeric && 'tabular',
        )}
        data-numeric={numeric ? '' : undefined}
      >
        {unavailableMessage ?? content}
      </dd>
    </div>
  );
}

/** Agrupa `InfoRow` numa lista de definições semântica. */
export function InfoList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('min-w-0', className)}>{children}</dl>;
}
