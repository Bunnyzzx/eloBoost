/**
 * Contratos das informações do sistema.
 *
 * Espelham `src-tauri/src/models/system.rs`. Todos os tamanhos chegam em
 * **bytes** e frequências em **MHz** — a formatação acontece em `utils/format`.
 */

/** Motivo pelo qual uma informação não pôde ser lida. */
export const UNAVAILABLE_REASONS = [
  'not_supported',
  'requires_elevation',
  'read_failed',
  'not_implemented',
] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/**
 * Informação que pode ou não estar disponível.
 *
 * União discriminada de propósito: o TypeScript obriga a tratar o caso
 * indisponível antes de acessar `value`, o que torna impossível exibir um dado
 * que o backend não leu. Nenhum campo do dashboard usa zero como "sem valor".
 */
export type Availability<T> =
  | { status: 'available'; value: T }
  | { status: 'unavailable'; reason: UnavailableReason; message: string };

/** Extrai o valor quando disponível; `null` caso contrário. */
export function availableValue<T>(field: Availability<T>): T | null {
  return field.status === 'available' ? field.value : null;
}

/** Mensagem a exibir quando o campo está indisponível; `null` quando há valor. */
export function unavailableMessage<T>(field: Availability<T>): string | null {
  return field.status === 'unavailable' ? field.message : null;
}

export interface OsInfo {
  computerName: Availability<string>;
  userName: Availability<string>;
  name: Availability<string>;
  /** Edição — ex.: "Windows 11 Pro". Exclusivo do Windows. */
  edition: Availability<string>;
  /** Versão comercial — ex.: "23H2". Exclusivo do Windows. */
  displayVersion: Availability<string>;
  build: Availability<number>;
  /** Sempre presente: resolvida em tempo de compilação. */
  architecture: string;
  kernelVersion: Availability<string>;
}

export interface CpuInfo {
  brand: Availability<string>;
  vendor: Availability<string>;
  physicalCores: Availability<number>;
  /** Sempre presente: toda máquina tem ao menos um processador lógico. */
  logicalCores: number;
  currentFrequencyMhz: Availability<number>;
}

export interface MemoryInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  /** Percentual já calculado no backend, 0–100. */
  usedPercent: number;
  swapTotalBytes: Availability<number>;
  swapUsedBytes: Availability<number>;
}

export interface GpuInfo {
  name: string;
  dedicatedMemoryBytes: Availability<number>;
  sharedMemoryBytes: Availability<number>;
  /** `true` para adaptadores de software, como o Microsoft Basic Render. */
  isSoftware: boolean;
}

export type DiskMediaType = 'ssd' | 'hdd' | 'unknown';

export interface DiskInfo {
  id: string;
  name: Availability<string>;
  /** Letra da unidade no Windows; ponto de montagem em outras plataformas. */
  mountPoint: string;
  fileSystem: Availability<string>;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  mediaType: DiskMediaType;
  isSystem: boolean;
  isRemovable: boolean;
}

export interface PrivilegeInfo {
  isElevated: Availability<boolean>;
  canElevate: Availability<boolean>;
}

export interface SystemSnapshot {
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpus: Availability<GpuInfo[]>;
  disks: DiskInfo[];
  uptimeSeconds: Availability<number>;
  privileges: PrivilegeInfo;
  collectedAt: string;
  /** Quanto tempo a coleta levou no backend. */
  collectionMs: number;
}

export interface AppRuntimeInfo {
  name: string;
  version: string;
  buildProfile: string;
  target: string;
  runningInTauri: boolean;
}
