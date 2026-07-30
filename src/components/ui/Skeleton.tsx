import { cn } from '@/utils/cn';

export interface SkeletonProps {
  className?: string;
  /** Texto lido por leitores de tela enquanto o conteúdo carrega. */
  label?: string;
  /** Some com o `role="status"` — use nos blocos internos de um skeleton composto. */
  silent?: boolean;
}

/**
 * Bloco de carregamento.
 *
 * Regra de UX (docs/08 §5): o skeleton tem a forma do conteúdo real — nunca um
 * símbolo girando ocupando a tela. O brilho vem de uma única animação CSS
 * (`elo-shimmer`), que a regra global de `prefers-reduced-motion` desliga.
 *
 * Em skeletons compostos, apenas o contêiner anuncia o estado de carregamento;
 * os blocos internos usam `silent` para não gerar vários anúncios.
 */
export function Skeleton({ className, label, silent = false }: SkeletonProps) {
  return (
    <div
      role={silent ? undefined : 'status'}
      aria-live={silent ? undefined : 'polite'}
      aria-busy={silent ? undefined : 'true'}
      aria-hidden={silent ? true : undefined}
      className={cn('relative overflow-hidden rounded-[8px] bg-elevated elo-shimmer', className)}
    >
      {!silent && <span className="sr-only">{label ?? 'Carregando…'}</span>}
    </div>
  );
}

/** Linhas de texto: a última é mais curta, como num parágrafo real. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('space-y-2.5', className)}>
      <span className="sr-only">Carregando conteúdo…</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          silent
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Card com título e linhas — o formato mais comum das telas do eloBoost. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('rounded-card border border-subtle bg-surface p-5', className)}
    >
      <span className="sr-only">Carregando…</span>
      <Skeleton silent className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            silent
            className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Silhueta de um indicador de recurso — rótulo, valor e barra.
 *
 * Preparado para os cards de CPU, memória e disco do Épico 1: o esqueleto tem
 * exatamente a altura do `Meter`, então não há salto de layout quando o dado
 * real chega.
 */
export function SkeletonMeter({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('min-w-0', className)}>
      <span className="sr-only">Carregando indicador…</span>
      <div className="flex items-baseline justify-between gap-3">
        <Skeleton silent className="h-3 w-24" />
        <Skeleton silent className="h-3.5 w-16" />
      </div>
      <Skeleton silent className="mt-2 h-1 w-full rounded-full" />
    </div>
  );
}

/**
 * Silhueta de uma linha de dado rotulado (`dt`/`dd`), usada nos cards de
 * informação do sistema.
 */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex items-center justify-between gap-4 py-2.5', className)}
    >
      <span className="sr-only">Carregando dado…</span>
      <Skeleton silent className="h-3 w-32" />
      <Skeleton silent className="h-3 w-24" />
    </div>
  );
}
