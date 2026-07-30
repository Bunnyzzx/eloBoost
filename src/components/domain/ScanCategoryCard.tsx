import { motion } from 'framer-motion';
import { Loader2, Lock } from 'lucide-react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Tooltip } from '@/components/ui/Tooltip';
import { DURATION_S, EASE } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  detailForScan,
  isPersonalArea,
  labelForStatus,
  skippedCount,
  toneForStatus,
} from '@/services/scannerService';
import type { CategoryScan } from '@/types/scanner';
import { hasMeasurement } from '@/types/scanner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

export interface ScanCategoryCardProps {
  scan: CategoryScan;
  /** `true` enquanto esta categoria ainda não respondeu. */
  pending: boolean;
  className?: string;
}

/**
 * Card de uma área analisada.
 *
 * Três estados visuais, e nenhum deles é um erro: **pendente** (a análise ainda
 * está nesta área), **medido** (números reais) e **sem medição** — que cobre
 * tanto "não existe neste computador" quanto "só existe no Windows". Uma área
 * ausente aparece em tom neutro de propósito: não ter cache do Firefox não é um
 * problema que o usuário precise resolver.
 */
export function ScanCategoryCard({ scan, pending, className }: ScanCategoryCardProps) {
  const reduceMotion = useReducedMotion();
  const measured = hasMeasurement(scan.status);
  const detail = detailForScan(scan);
  const ignored = skippedCount(scan);
  const personal = isPersonalArea(scan);

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold break-words text-fg">{scan.name}</h3>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-fg-muted">{scan.description}</p>
        </div>

        {pending ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-fg-muted">
            <Loader2
              aria-hidden
              className={cn('size-3.5', reduceMotion ? 'opacity-60' : 'animate-spin')}
              strokeWidth={2}
            />
            Analisando
          </span>
        ) : (
          <StatusBadge
            tone={toneForStatus(scan.status)}
            className="shrink-0"
            {...(scan.message != null ? { hint: scan.message } : {})}
          >
            {labelForStatus(scan.status)}
          </StatusBadge>
        )}
      </div>

      <div className="mt-auto pt-4">
        {pending ? (
          /* Um traço no lugar dos números: nunca um zero, que passaria por
             medição concluída. */
          <p className="text-2xl font-semibold text-fg-muted" aria-hidden>
            —
          </p>
        ) : measured ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DURATION_S.base, ease: EASE }}
          >
            <p className="text-2xl font-semibold text-fg tabular" data-numeric>
              {formatBytes(scan.sizeBytes)}
            </p>
            <p className="mt-1 text-[0.75rem] text-fg-secondary tabular" data-numeric>
              {formatCount(scan.fileCount)} {scan.fileCount === 1 ? 'arquivo' : 'arquivos'}
              {scan.folderCount > 0 && (
                <>
                  {' · '}
                  {formatCount(scan.folderCount)} {scan.folderCount === 1 ? 'pasta' : 'pastas'}
                </>
              )}
            </p>
          </motion.div>
        ) : (
          <p className="text-[0.8125rem] text-fg-muted">Sem medição para esta área.</p>
        )}

        {detail != null && (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-fg-muted">{detail}</p>
        )}

        {personal && (
          <Tooltip
            content="São arquivos seus. O eloBoost mede o espaço, mas nunca remove nada daqui em lote."
            side="top"
          >
            <span
              tabIndex={0}
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 rounded-full border border-subtle',
                'bg-base/40 px-2.5 py-1 text-[0.6875rem] text-fg-muted',
              )}
            >
              <Lock aria-hidden className="size-3" strokeWidth={2} />
              {/* Descreve a política, não o resultado: continua verdadeiro
                  mesmo quando a área não existe neste computador. */}
              Nunca limpo em lote
            </span>
          </Tooltip>
        )}

        {ignored > 0 && !pending && (
          <p className="mt-2 text-[0.6875rem] text-fg-muted tabular" data-numeric>
            {formatCount(ignored)} {ignored === 1 ? 'item ignorado' : 'itens ignorados'}
          </p>
        )}
      </div>
    </Card>
  );
}
