import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Usa a superfície elevada — para cards sobre cards. */
  elevated?: boolean;
  /** Realce sutil da borda, para o card em foco da tela. */
  highlighted?: boolean;
  /**
   * Reage ao ponteiro: borda mais clara e elevação de 1 px.
   *
   * Use apenas em cards que o usuário pode acionar. Um card informativo que
   * responde ao mouse sem ter ação sugere clique onde não há nenhum.
   */
  interactive?: boolean;
}

export function Card({
  elevated,
  highlighted,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border',
        // Só cor e sombra fazem parte da transição base: animar `transform`
        // aqui faria o card tremer durante a entrada escalonada.
        'transition-[background-color,border-color,box-shadow] duration-(--elo-duration-instant) ease-elo',
        elevated ? 'bg-elevated' : 'bg-surface',
        highlighted ? 'border-accent/45 shadow-elo-md' : 'border-subtle shadow-elo-sm',
        interactive && [
          'cursor-default hover:border-strong hover:shadow-elo-md',
          // 1 px é o suficiente para o card "levantar" sem deslocar o texto
          // vizinho nem provocar reflow — a translação não afeta o layout.
          'hover:-translate-y-px motion-safe:transition-transform',
        ],
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
          {/*
            Títulos de card são textos do produto, não dados do usuário: quebrar
            em duas linhas é sempre melhor do que cortar ("Segurança em primeiro
            lu…"). `break-words` protege contra uma palavra longa demais.
          */}
          <h2 className="text-[0.9375rem] font-semibold break-words text-fg">{title}</h2>
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
