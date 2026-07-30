import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  /** Texto anunciado por leitores de tela. */
  label?: string;
  className?: string;
}

/**
 * Indicador discreto para ações pequenas — um botão em curso, um campo
 * revalidando.
 *
 * Para o carregamento de uma tela inteira, use `Skeleton`: uma silhueta do
 * conteúdo real informa mais do que um símbolo girando (docs/08 §5).
 *
 * A rotação respeita `prefers-reduced-motion` pela regra global em
 * `globals.css`, que reduz a duração de qualquer animação a ~0. Como o
 * componente também expõe `role="status"` com texto, quem desligou movimento
 * continua sabendo que algo está em andamento.
 */
export function Spinner({ size = 'sm', label = 'Carregando…', className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center', className)}>
      <Loader2
        aria-hidden
        className={cn('animate-spin text-fg-muted', size === 'sm' ? 'size-4' : 'size-5')}
        strokeWidth={2}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
