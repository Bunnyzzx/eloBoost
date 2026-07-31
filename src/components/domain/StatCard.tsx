import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  /** Valor principal, já formatado. `null` exibe o texto de indisponível. */
  value: ReactNode | null;
  /** Linha secundária — contexto do valor. */
  detail?: ReactNode;
  /** Frase exibida quando `value` é `null`. */
  unavailableText?: string;
  /** Canto superior direito — normalmente um `StatusBadge`. */
  badge?: ReactNode;
  /** Exibe a silhueta em vez do conteúdo. */
  loading?: boolean;
  className?: string;
}

/**
 * Card de métrica: ícone, rótulo, valor destacado e um detalhe.
 *
 * É o card mais reutilizado do dashboard. Não sabe nada sobre CPU, memória ou
 * disco — recebe strings já formatadas, mantendo a formatação em `utils/format`
 * e a derivação em `services/`.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  unavailableText = 'Informação não suportada neste dispositivo.',
  badge,
  loading = false,
  className,
}: StatCardProps) {
  /** Acima deste comprimento, o valor não cabe em uma linha no corpo grande. */
  const isLongValue = typeof value === 'string' && value.length > 18;

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-fg-secondary">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent-soft text-accent"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <span className="truncate">{label}</span>
        </span>
        {badge != null && <span className="shrink-0">{badge}</span>}
      </div>

      <div className="mt-3">
        {loading ? (
          <>
            <Skeleton className="h-7 w-24" label={`Carregando ${label}`} />
            <Skeleton silent className="mt-2 h-3 w-32" />
          </>
        ) : value == null ? (
          <p className="text-[0.8125rem] leading-relaxed text-fg-muted italic">{unavailableText}</p>
        ) : (
          <>
            {/*
              Nomes de processador e de placa de vídeo passam de 30 caracteres com
              frequência ("Intel(R) Xeon(R) Platinum 8375C"). Truncar em uma linha
              esconderia justamente o modelo, que é o dado que interessa: valores
              longos caem para duas linhas em corpo menor.
            */}
            <p
              className={cn(
                'font-semibold tracking-tight text-fg tabular',
                isLongValue ? 'line-clamp-2 text-base leading-snug' : 'truncate text-xl',
              )}
              data-numeric
              title={typeof value === 'string' ? value : undefined}
            >
              {value}
            </p>
            {detail != null && (
              <p
                className="mt-1 truncate text-[0.75rem] text-fg-muted"
                title={typeof detail === 'string' ? detail : undefined}
              >
                {detail}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
