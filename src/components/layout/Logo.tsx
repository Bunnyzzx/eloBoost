import { cn } from '@/utils/cn';

export interface LogoProps {
  /** Exibe apenas a marca, sem o texto. */
  compact?: boolean;
  className?: string;
}

/**
 * Marca do eloBoost — identidade própria (docs/08 §1).
 *
 * Hexágono de traço fino ("core") com um traço interno ascendente que sugere
 * um gráfico de desempenho. Nenhum ativo de terceiros.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="eloBoost"
      className={cn('size-7 shrink-0', className)}
    >
      <defs>
        <linearGradient id="elo-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--elo-accent-hover)" />
          <stop offset="100%" stopColor="var(--elo-violet)" />
        </linearGradient>
      </defs>

      {/* Hexágono: o "core" */}
      <path
        d="M16 2.6 27.4 9.3v13.4L16 29.4 4.6 22.7V9.3Z"
        fill="none"
        stroke="url(#elo-mark-gradient)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Traço ascendente: desempenho medido, não prometido */}
      <path
        d="M10.5 20.2l4-4.6 3 2.6 4.2-6"
        fill="none"
        stroke="var(--elo-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.7" cy="12.2" r="1.9" fill="var(--elo-accent)" />
    </svg>
  );
}

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[0.9375rem] tracking-tight text-fg">
          <span className="font-normal text-fg-secondary">elo</span>
          <span className="font-semibold">Boost</span>
        </span>
      )}
    </span>
  );
}
