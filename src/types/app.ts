/**
 * Tipos da infraestrutura do aplicativo (Épico 0).
 *
 * Estes são os únicos contratos implementados nesta fase: identificação do
 * app e diagnóstico do banco local. Nenhuma informação nativa do Windows,
 * limpeza ou otimização existe ainda — esses contratos entram nos Épicos 1+.
 */

/** Nível de risco usado em toda a interface. Sempre acompanhado de rótulo textual. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Identificador de operação (UUID) que correlaciona UI, banco e log técnico. */
export type OperationId = string;

/** Resposta paginada padrão. */
export interface Paged<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Informações do próprio aplicativo — não do sistema operacional. */
export interface AppInfo {
  name: string;
  version: string;
  /** Identificador do build (`debug` ou `release`). */
  buildProfile: string;
  /** `true` quando a interface está rodando dentro do Tauri. */
  runningInTauri: boolean;
}

/** Estado do banco local, exposto para diagnóstico na tela Sobre. */
export interface DatabaseStatus {
  /** Versão do schema efetivamente aplicada. */
  schemaVersion: number;
  /** Versão do schema que este build espera. */
  expectedVersion: number;
  appliedMigrations: AppliedMigration[];
  /** Caminho do arquivo do banco, já mascarado (sem o nome do usuário). */
  databasePathMasked: string;
  sizeBytes: number;
  healthy: boolean;
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}
