/**
 * Serviço de informações do sistema.
 *
 * Toda a derivação de dado acontece aqui, não nos componentes: a página recebe
 * valores prontos para exibir. O backend já entrega um retrato único, então o
 * serviço faz uma chamada só — nada de várias requisições por card.
 */

import { appRuntimeInfoSchema, systemSnapshotSchema } from '@/schemas/system';
import { invokeCommand } from '@/services/ipc';
import type {
  AppRuntimeInfo,
  DiskInfo,
  GpuInfo,
  SystemSnapshot,
  Availability,
} from '@/types/system';
import { availableValue } from '@/types/system';

/**
 * Lê o retrato completo do computador.
 *
 * Uma única chamada devolve sistema, CPU, memória, GPU, volumes, tempo ligado e
 * privilégio — as leituras lentas já rodam em paralelo no backend.
 */
export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  return invokeCommand('system_get_snapshot', systemSnapshotSchema);
}

/** Lê nome, versão, perfil e alvo de compilação do aplicativo. */
export async function getAppRuntimeInfo(): Promise<AppRuntimeInfo> {
  return invokeCommand('app_get_runtime_info', appRuntimeInfoSchema);
}

/**
 * Escolhe a GPU principal.
 *
 * O backend já entrega os adaptadores de hardware antes dos de software, então
 * o primeiro item é o que o usuário reconhece como "sua placa de vídeo".
 */
export function primaryGpu(gpus: Availability<GpuInfo[]>): GpuInfo | null {
  const list = availableValue(gpus);
  if (list == null || list.length === 0) return null;
  return list.find((gpu) => !gpu.isSoftware) ?? list[0] ?? null;
}

/** Volume onde o Windows está instalado, quando identificado. */
export function systemDisk(disks: readonly DiskInfo[]): DiskInfo | null {
  return disks.find((disk) => disk.isSystem) ?? disks[0] ?? null;
}

/** Soma da capacidade e do espaço livre de todos os volumes. */
export function storageTotals(disks: readonly DiskInfo[]): {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
} {
  const totals = disks.reduce(
    (acc, disk) => ({
      totalBytes: acc.totalBytes + disk.totalBytes,
      usedBytes: acc.usedBytes + disk.usedBytes,
      availableBytes: acc.availableBytes + disk.availableBytes,
    }),
    { totalBytes: 0, usedBytes: 0, availableBytes: 0 },
  );

  return {
    ...totals,
    usedPercent: totals.totalBytes === 0 ? 0 : (totals.usedBytes / totals.totalBytes) * 100,
  };
}

/** Rótulo curto do tipo de mídia, para exibição. */
export function mediaTypeLabel(mediaType: DiskInfo['mediaType']): string {
  switch (mediaType) {
    case 'ssd':
      return 'SSD';
    case 'hdd':
      return 'HD';
    case 'unknown':
      // O backend não determinou o tipo; dizer "SSD" seria inventar.
      return 'Tipo não identificado';
  }
}

/**
 * Rótulo do privilégio atual.
 *
 * O eloBoost roda sem elevação por padrão; este texto informa o estado sem
 * sugerir que rodar elevado seria melhor.
 */
export function privilegeLabel(isElevated: Availability<boolean>): {
  label: string;
  detail: string;
  elevated: boolean | null;
} {
  const value = availableValue(isElevated);

  if (value === null) {
    return {
      label: 'Indeterminado',
      detail: 'Não foi possível verificar o privilégio do processo.',
      elevated: null,
    };
  }

  return value
    ? {
        label: 'Administrador',
        detail: 'O eloBoost está rodando elevado nesta sessão.',
        elevated: true,
      }
    : {
        label: 'Normal',
        detail: 'A elevação é pedida por operação, apenas quando necessária.',
        elevated: false,
      };
}
