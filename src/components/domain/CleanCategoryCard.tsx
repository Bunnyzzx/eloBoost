import { motion } from 'framer-motion';
import { Loader2, Lock } from 'lucide-react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tooltip } from '@/components/ui/Tooltip';
import { DURATION_S, EASE } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  labelForCleanStatus,
  labelForEligibility,
  skippedCount,
  toneForCleanStatus,
} from '@/services/cleanerService';
import type { CategoryCleanResult, CategoryPreview } from '@/types/cleaner';
import { isSelectable } from '@/types/cleaner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

export interface CleanCategoryCardProps {
  preview: CategoryPreview;
  /** Estado ao vivo, presente apenas durante e depois da limpeza. */
  result?: CategoryCleanResult | undefined;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  /** Impede mudar a seleção enquanto a limpeza roda. */
  locked: boolean;
  className?: string;
}

/**
 * Card de uma categoria na tela de Limpeza.
 *
 * Um único card cobre as três fases — seleção, execução e resultado — em vez de
 * três componentes que o usuário veria trocando de lugar. O que muda é o que
 * ele mostra:
 *
 * - **Seleção**: caixa marcável, tamanho e contagem da prévia.
 * - **Execução**: selo de estado ao vivo e números que sobem.
 * - **Resultado**: espaço liberado de fato, e o que ficou para trás.
 *
 * Uma categoria não selecionável nunca ganha caixa marcável — a política do
 * backend chega até o pixel.
 */
export function CleanCategoryCard({
  preview,
  result,
  checked,
  onToggle,
  locked,
  className,
}: CleanCategoryCardProps) {
  const reduceMotion = useReducedMotion();
  const selectable = isSelectable(preview);
  const eligibilityLabel = labelForEligibility(preview);
  const personal = preview.eligibility === 'read_only_area';

  const running = result?.status === 'running';
  const finished =
    result != null && ['completed', 'partially_completed', 'failed'].includes(result.status);

  // Durante a limpeza o card mostra o que já saiu; antes, o que sairia.
  const shownBytes = finished || running ? (result?.freedBytes ?? 0) : preview.sizeBytes;
  const shownFiles = finished || running ? (result?.removedFiles ?? 0) : preview.fileCount;
  const ignored = result != null ? skippedCount(result) : 0;

  return (
    <Card
      className={cn('flex h-full flex-col p-4', className)}
      highlighted={selectable && checked && !finished}
    >
      <div className="flex items-start justify-between gap-3">
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={onToggle}
            disabled={locked}
            disabledReason="A seleção não pode mudar durante a limpeza."
            label={preview.name}
            description={preview.description}
          />
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{preview.name}</p>
            <p className="mt-0.5 text-[0.75rem] leading-relaxed text-fg-muted">
              {preview.description}
            </p>
          </div>
        )}

        {running ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-fg-muted">
            <Loader2
              aria-hidden
              className={cn('size-3.5', reduceMotion ? 'opacity-60' : 'animate-spin')}
              strokeWidth={2}
            />
            Limpando
          </span>
        ) : result != null && result.status !== 'pending' && result.status !== 'skipped' ? (
          <StatusBadge
            tone={toneForCleanStatus(result.status)}
            className="shrink-0"
            {...(result.message != null ? { hint: result.message } : {})}
          >
            {labelForCleanStatus(result.status)}
          </StatusBadge>
        ) : eligibilityLabel != null ? (
          <StatusBadge
            tone="unknown"
            className="shrink-0"
            {...(preview.note != null ? { hint: preview.note } : {})}
          >
            {eligibilityLabel}
          </StatusBadge>
        ) : null}
      </div>

      <div className="mt-auto pt-4">
        <motion.div
          key={finished ? 'final' : 'previa'}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION_S.base, ease: EASE }}
        >
          <p className="text-2xl font-semibold text-fg tabular" data-numeric>
            {formatBytes(shownBytes)}
          </p>
          <p className="mt-1 text-[0.75rem] text-fg-secondary tabular" data-numeric>
            {formatCount(shownFiles)} {shownFiles === 1 ? 'arquivo' : 'arquivos'}
            {finished ? ' removidos' : running ? ' até agora' : ''}
          </p>
        </motion.div>

        {finished && result?.message != null && (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-fg-muted">{result.message}</p>
        )}

        {!finished && preview.note != null && (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-fg-muted">{preview.note}</p>
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
              Nunca limpo em lote
            </span>
          </Tooltip>
        )}

        {finished && ignored > 0 && (
          <p className="mt-2 text-[0.6875rem] text-fg-muted tabular" data-numeric>
            {formatCount(ignored)} {ignored === 1 ? 'item mantido' : 'itens mantidos'}
          </p>
        )}
      </div>
    </Card>
  );
}
