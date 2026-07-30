import { HardDrive } from 'lucide-react';

import { StorageCard, StorageCardSkeleton } from '@/components/domain/StorageCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StaggerItem } from '@/components/motion/Stagger';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { storageTotals } from '@/services/systemService';
import type { DiskInfo } from '@/types/system';
import { formatBytes, formatCount, formatPercent } from '@/utils/format';

export interface StorageSectionProps {
  disks: readonly DiskInfo[] | null;
  loading: boolean;
}

/**
 * Faixa de armazenamento: um card por volume, com o total agregado no cabeçalho.
 *
 * O backend entrega os volumes já ordenados (sistema primeiro) e sem os
 * pseudo-sistemas de arquivos, então esta seção não filtra nem reordena nada.
 */
export function StorageSection({ disks, loading }: StorageSectionProps) {
  const totals = disks != null ? storageTotals(disks) : null;

  return (
    <Card>
      <CardHeader
        icon={<HardDrive className="size-4" />}
        title="Armazenamento"
        description={
          totals == null
            ? 'Capacidade e espaço livre de cada volume.'
            : `${formatCount(disks?.length ?? 0)} ${
                (disks?.length ?? 0) === 1 ? 'volume' : 'volumes'
              } · ${formatBytes(totals.usedBytes)} de ${formatBytes(
                totals.totalBytes,
              )} em uso (${formatPercent(totals.usedPercent)})`
        }
      />
      <CardBody>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Duas silhuetas: o número real de volumes só é conhecido depois da
                resposta, e três esqueletos numa máquina de um disco pareceria
                que faltou carregar algo. */}
            <StorageCardSkeleton />
            <StorageCardSkeleton />
          </div>
        ) : disks == null || disks.length === 0 ? (
          <EmptyState
            icon={HardDrive}
            title="Nenhum volume encontrado"
            description="O eloBoost não conseguiu enumerar os discos deste computador. Isso pode acontecer em ambientes virtualizados."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {disks.map((disk, index) => (
              <StaggerItem key={disk.id} index={index}>
                <StorageCard disk={disk} />
              </StaggerItem>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
