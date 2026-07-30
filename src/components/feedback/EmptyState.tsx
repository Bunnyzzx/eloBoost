import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  /** Nota secundária — usada para indicar em qual etapa a tela será entregue. */
  note?: ReactNode;
  className?: string;
}

/**
 * Estado vazio.
 *
 * Sempre explica o motivo e sugere um caminho — nunca uma tela em branco
 * (docs/08 §5).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  note,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-strong',
        'bg-surface/50 px-8 py-14 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent"
      >
        <Icon className="size-6" strokeWidth={1.5} />
      </span>

      <h3 className="mt-5 text-base font-semibold text-fg">{title}</h3>
      <div className="mt-2 max-w-md text-sm leading-relaxed text-fg-secondary">{description}</div>

      {action != null && <div className="mt-6">{action}</div>}

      {note != null && (
        <p className="mt-6 rounded-full border border-subtle bg-elevated px-3 py-1 text-[0.75rem] text-fg-muted">
          {note}
        </p>
      )}
    </div>
  );
}
