import { Layers } from 'lucide-react';

import { InfoList, InfoRow } from '@/components/domain/InfoRow';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { SkeletonRow } from '@/components/ui/Skeleton';
import type { SystemSnapshot } from '@/types/system';
import { availableValue } from '@/types/system';
import { formatBytes, formatCount } from '@/utils/format';

export interface SystemDetailsCardProps {
  snapshot: SystemSnapshot | null;
  loading: boolean;
}

/**
 * Ficha técnica do computador.
 *
 * Cada linha recebe o `Availability` direto do backend: quando um campo não pode
 * ser lido — edição do Windows fora do Windows, por exemplo — a linha exibe o
 * motivo, o que é informação útil, e não um espaço em branco.
 */
export function SystemDetailsCard({ snapshot, loading }: SystemDetailsCardProps) {
  const swapTotal = snapshot != null ? availableValue(snapshot.memory.swapTotalBytes) : null;
  const swapUsed = snapshot != null ? availableValue(snapshot.memory.swapUsedBytes) : null;

  return (
    <Card>
      <CardHeader
        icon={<Layers className="size-4" />}
        title="Seu computador"
        description="Dados lidos diretamente do sistema operacional."
      />
      <CardBody>
        {loading || snapshot == null ? (
          <div>
            {Array.from({ length: 7 }, (_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : (
          <InfoList>
            <InfoRow label="Nome do computador" value={snapshot.os.computerName} selectable />
            <InfoRow label="Usuário" value={snapshot.os.userName} />
            <InfoRow label="Sistema" value={snapshot.os.name} />
            {/* "Versão" sozinho colidia com a versão do eloBoost, exibida no card
                ao lado. O rótulo diz de qual versão se trata. */}
            <InfoRow label="Edição do Windows" value={snapshot.os.edition} />
            <InfoRow
              label="Versão do Windows"
              value={snapshot.os.displayVersion}
              hint="Versão comercial do Windows, como 23H2."
            />
            <InfoRow label="Build" value={snapshot.os.build} numeric />
            <InfoRow
              label="Arquitetura"
              value={snapshot.os.architecture}
              hint="Conjunto de instruções do processador para o qual este build foi compilado."
            />
            <InfoRow label="Kernel" value={snapshot.os.kernelVersion} numeric />
            <InfoRow
              label="Memória instalada"
              value={formatBytes(snapshot.memory.totalBytes)}
              numeric
            />
            <InfoRow
              label="Processadores lógicos"
              value={formatCount(snapshot.cpu.logicalCores)}
              hint="Total de threads que o sistema pode escalonar ao mesmo tempo."
              numeric
            />
            <InfoRow label="Fabricante da CPU" value={snapshot.cpu.vendor} />
            <InfoRow
              label="Arquivo de paginação"
              value={
                swapTotal == null || swapUsed == null
                  ? snapshot.memory.swapTotalBytes
                  : `${formatBytes(swapUsed)} de ${formatBytes(swapTotal)}`
              }
              hint="Espaço em disco que o Windows usa como extensão da memória."
              numeric
            />
          </InfoList>
        )}
      </CardBody>
    </Card>
  );
}
