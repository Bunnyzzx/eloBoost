import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
  /** Desliga o tooltip sem precisar remover o componente da árvore. */
  disabled?: boolean;
}

const SIDES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

/**
 * Tooltip acessível para termos técnicos.
 *
 * Aparece tanto no hover quanto no foco por teclado, e é associado ao gatilho
 * por `aria-describedby` — quem usa leitor de tela recebe a mesma informação
 * que quem usa mouse.
 */
export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  if (disabled === true) return <>{children}</>;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined} className="inline-flex">
        {children}
      </span>

      <span
        id={id}
        role="tooltip"
        hidden={!visible}
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-64',
          'rounded-[8px] border border-strong bg-elevated px-2.5 py-1.5',
          'text-[0.75rem] leading-snug font-normal text-fg shadow-elo-md',
          SIDES[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
