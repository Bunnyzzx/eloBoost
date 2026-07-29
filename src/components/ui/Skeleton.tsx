import { cn } from '@/utils/cn';

export interface SkeletonProps {
  className?: string;
  /** Texto lido por leitores de tela enquanto o conteúdo carrega. */
  label?: string;
}

/**
 * Placeholder de carregamento.
 *
 * Regra de UX (docs/08 §5): skeletons têm a forma do conteúdo real — nunca um
 * spinner solto ocupando a tela inteira.
 */
export function Skeleton({ className, label }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'relative overflow-hidden rounded-[8px] bg-elevated elo-shimmer',
        className,
      )}
    >
      <span className="sr-only">{label ?? 'Carregando…'}</span>
    </div>
  );
}

/** Bloco de skeleton no formato de um card com título e linhas. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-subtle bg-surface p-5">
      <Skeleton className="h-4 w-1/3" label="Carregando título" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
            label="Carregando conteúdo"
          />
        ))}
      </div>
    </div>
  );
}
