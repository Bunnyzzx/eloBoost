import { History, Info } from 'lucide-react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaggerItem } from '@/components/motion/Stagger';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listHistory, toneForHistoryResult } from '@/services/cleanerService';
import type { HistoryEntry } from '@/types/cleaner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount, formatDateTime, formatRelative } from '@/utils/format';

/** Rótulo em português do resultado de uma operação. */
function resultLabel(result: string): string {
  switch (result) {
    case 'success':
      return 'Concluído';
    case 'partial':
      return 'Concluído em parte';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelado';
    default:
      return result;
  }
}

function EntryCard({ entry }: { entry: HistoryEntry }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{entry.message}</p>
          <p
            className="mt-0.5 text-[0.75rem] text-fg-muted"
            title={formatDateTime(entry.createdAt)}
          >
            {formatRelative(entry.createdAt)}
          </p>
        </div>

        <StatusBadge tone={toneForHistoryResult(entry.result)} className="shrink-0">
          {resultLabel(entry.result)}
        </StatusBadge>
      </div>

      <div className="mt-3.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <p className="text-lg font-semibold text-fg tabular" data-numeric>
          {formatBytes(entry.releasedBytes)}
          <span className="ml-1.5 text-[0.75rem] font-normal text-fg-muted">liberados</span>
        </p>
        <p className="text-[0.8125rem] text-fg-secondary tabular" data-numeric>
          {formatCount(entry.affectedCount)}{' '}
          {entry.affectedCount === 1 ? 'arquivo removido' : 'arquivos removidos'}
        </p>
      </div>

      {entry.details != null && (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-fg-muted">{entry.details}</p>
      )}
    </Card>
  );
}

/**
 * Histórico de operações.
 *
 * **Informativo.** O Épico 3 não implementa restauração, e a tela não sugere
 * que ela exista: não há botão de desfazer, e o aviso no rodapé diz isso com
 * todas as letras. Prometer uma reversão inexistente seria pior do que não
 * oferecê-la.
 */
export function HistoryPage() {
  const history = useAsync(listHistory);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico"
        description="Tudo o que o eloBoost já fez neste computador, com os números de cada operação."
      />

      {history.status === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-28 w-full rounded-card"
              {...(index > 0 ? { silent: true } : { label: 'Carregando o histórico' })}
            />
          ))}
        </div>
      )}

      {history.status === 'error' && history.error != null && (
        <ErrorState error={history.error} onRetry={history.reload} />
      )}

      {history.status === 'success' && history.data != null && history.data.length === 0 && (
        <EmptyState
          icon={History}
          title="Nenhuma operação ainda"
          description="Quando você fizer uma limpeza, ela aparece aqui com o espaço liberado e o que foi removido."
          note="O histórico fica apenas neste computador."
        />
      )}

      {history.status === 'success' && history.data != null && history.data.length > 0 && (
        <>
          <div className="space-y-3">
            {history.data.map((entry, index) => (
              <StaggerItem key={entry.id} index={index}>
                <EntryCard entry={entry} />
              </StaggerItem>
            ))}
          </div>

          <p
            className={cn(
              'flex items-start gap-2.5 rounded-[10px] border border-subtle',
              'bg-base/40 px-4 py-3 text-[0.75rem] leading-relaxed text-fg-muted',
            )}
          >
            <Info aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={1.75} />O histórico é
            informativo e fica somente neste computador. Arquivos removidos numa limpeza não podem
            ser restaurados por aqui.
          </p>
        </>
      )}
    </div>
  );
}
