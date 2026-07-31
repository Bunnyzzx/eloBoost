import { HardDrive, MonitorSmartphone, Usb } from 'lucide-react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card } from '@/components/ui/Card';
import { ProgressBar, type ProgressTone } from '@/components/ui/ProgressBar';
import { Skeleton, SkeletonMeter } from '@/components/ui/Skeleton';
import { mediaTypeLabel } from '@/services/systemService';
import type { DiskInfo } from '@/types/system';
import { availableValue } from '@/types/system';
import { formatBytes, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import { toneForUsage } from '@/utils/status';

export interface StorageCardProps {
  disk: DiskInfo;
  className?: string;
}

const BAR_TONE: Record<string, ProgressTone> = {
  ok: 'accent',
  attention: 'attention',
  critical: 'critical',
};

/**
 * Card de um volume de armazenamento.
 *
 * Recebe o `DiskInfo` já pronto do backend — nenhuma conta acontece aqui além
 * da formatação. O tom do indicador vem de `toneForUsage`, o mesmo usado por
 * memória, para que "atenção" signifique a mesma coisa em toda a interface.
 */
export function StorageCard({ disk, className }: StorageCardProps) {
  const tone = toneForUsage(disk.usedPercent);
  const label = availableValue(disk.name);
  const fileSystem = availableValue(disk.fileSystem);

  const Icon = disk.isRemovable ? Usb : disk.isSystem ? MonitorSmartphone : HardDrive;

  const descricao = [label, mediaTypeLabel(disk.mediaType), fileSystem]
    .filter((part): part is string => part != null && part.length > 0)
    .join(' · ');

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-accent-soft text-accent"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>

          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              {/* O rótulo do volume é escolhido pelo usuário e pode ser longo:
                  truncar sem `title` esconderia o dado sem oferecer saída. */}
              <span className="truncate" title={disk.mountPoint}>
                {disk.mountPoint}
              </span>
              {disk.isSystem && (
                <span className="shrink-0 rounded-full border border-subtle bg-elevated px-1.5 py-px text-[0.625rem] font-normal text-fg-muted">
                  sistema
                </span>
              )}
            </p>
            <p className="truncate text-[0.75rem] text-fg-muted" title={descricao}>
              {descricao}
            </p>
          </div>
        </div>

        {(tone === 'attention' || tone === 'critical') && (
          <StatusBadge
            tone={tone}
            hint={
              tone === 'critical'
                ? 'Espaço quase esgotado. O Windows precisa de espaço livre para funcionar bem.'
                : 'Espaço livre ficando baixo.'
            }
          >
            {tone === 'critical' ? 'Crítico' : 'Atenção'}
          </StatusBadge>
        )}
      </div>

      <div className="mt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[0.8125rem] text-fg-secondary tabular" data-numeric>
            <span className="font-semibold text-fg">{formatBytes(disk.usedBytes)}</span>
            {' de '}
            {formatBytes(disk.totalBytes)}
          </p>
          <p
            className="shrink-0 text-[0.8125rem] font-medium text-fg-secondary tabular"
            data-numeric
          >
            {formatPercent(disk.usedPercent)}
          </p>
        </div>

        <ProgressBar
          value={disk.usedPercent}
          tone={BAR_TONE[tone] ?? 'accent'}
          label={`Uso do volume ${disk.mountPoint}`}
          className="mt-2.5"
        />

        <p className="mt-2 text-[0.75rem] text-fg-muted tabular" data-numeric>
          {formatBytes(disk.availableBytes)} livres
        </p>
      </div>
    </Card>
  );
}

/** Silhueta com a mesma altura do card real, para não haver salto de layout. */
export function StorageCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-[8px]" label="Carregando volume" />
        <div className="min-w-0 flex-1">
          <Skeleton silent className="h-3.5 w-20" />
          <Skeleton silent className="mt-1.5 h-3 w-32" />
        </div>
      </div>
      <SkeletonMeter className="mt-3.5" />
      <Skeleton silent className="mt-2 h-3 w-24" />
    </Card>
  );
}
