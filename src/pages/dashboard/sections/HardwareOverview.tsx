import { Clock, Cpu, MemoryStick, MonitorPlay } from 'lucide-react';

import { ProgressCard } from '@/components/domain/ProgressCard';
import { StatCard } from '@/components/domain/StatCard';
import { StaggerItem } from '@/components/motion/Stagger';
import { primaryGpu } from '@/services/systemService';
import type { SystemSnapshot } from '@/types/system';
import { availableValue } from '@/types/system';
import { formatBytes, formatDuration, formatFrequency } from '@/utils/format';

export interface HardwareOverviewProps {
  snapshot: SystemSnapshot | null;
  loading: boolean;
}

/**
 * Primeira faixa do dashboard: processador, memória, vídeo e tempo ligado.
 *
 * Toda a derivação vem do serviço; aqui só há formatação. Um campo que o backend
 * marcou como indisponível é passado como `null`, e o card exibe a frase do
 * motivo em vez de um número.
 */
export function HardwareOverview({ snapshot, loading }: HardwareOverviewProps) {
  const cpu = snapshot?.cpu;
  const memory = snapshot?.memory;
  const gpu = snapshot != null ? primaryGpu(snapshot.gpus) : null;

  const frequency = cpu != null ? availableValue(cpu.currentFrequencyMhz) : null;
  const physicalCores = cpu != null ? availableValue(cpu.physicalCores) : null;
  const uptime = snapshot != null ? availableValue(snapshot.uptimeSeconds) : null;
  const vram = gpu != null ? availableValue(gpu.dedicatedMemoryBytes) : null;

  const coreDetail =
    cpu == null
      ? undefined
      : physicalCores != null
        ? `${physicalCores} núcleos físicos · ${cpu.logicalCores} lógicos`
        : `${cpu.logicalCores} processadores lógicos`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem index={0}>
        <StatCard
          icon={Cpu}
          label="Processador"
          loading={loading}
          value={cpu == null ? null : (availableValue(cpu.brand) ?? 'Modelo não identificado')}
          detail={coreDetail}
          badge={
            frequency != null ? (
              <span className="text-[0.75rem] font-medium text-fg-secondary tabular" data-numeric>
                {formatFrequency(frequency)}
              </span>
            ) : undefined
          }
        />
      </StaggerItem>

      <StaggerItem index={1}>
        <ProgressCard
          icon={MemoryStick}
          label="Memória"
          loading={loading}
          percent={memory?.usedPercent ?? null}
          value={
            memory == null
              ? undefined
              : `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`
          }
          remaining={memory == null ? undefined : `${formatBytes(memory.availableBytes)} livres`}
        />
      </StaggerItem>

      <StaggerItem index={2}>
        <StatCard
          icon={MonitorPlay}
          label="Placa de vídeo"
          loading={loading}
          value={gpu?.name ?? null}
          detail={
            vram != null && vram > 0
              ? `${formatBytes(vram)} de memória dedicada`
              : gpu != null
                ? 'Memória compartilhada com o sistema'
                : undefined
          }
        />
      </StaggerItem>

      <StaggerItem index={3}>
        <StatCard
          icon={Clock}
          label="Tempo ligado"
          loading={loading}
          value={uptime == null ? null : formatDuration(uptime)}
          detail={uptime == null ? undefined : 'desde a última inicialização'}
        />
      </StaggerItem>
    </div>
  );
}
