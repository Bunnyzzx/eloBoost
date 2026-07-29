import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Usa a superfície elevada — para cards sobre cards. */
  elevated?: boolean;
  /** Realce sutil da borda, para o card em foco da tela. */
  highlighted?: boolean;
}

export function Card({ elevated, highlighted, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border transition-colors duration-200 ease-elo',
        elevated ? 'bg-elevated' : 'bg-surface',
        highlighted ? 'border-accent/45 shadow-elo-md' : 'border-subtle shadow-elo-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Ação alinhada à direita (botão, filtro, badge). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon != null && (
          <span
            aria-hidden
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-accent-soft text-accent"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[0.9375rem] font-semibold text-fg">{title}</h2>
          {description != null && (
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-fg-secondary">
              {description}
            </p>
          )}
        </div>
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pt-2', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-subtle px-5 py-3.5', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
