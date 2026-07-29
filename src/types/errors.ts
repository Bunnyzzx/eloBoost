/**
 * Contrato de erros entre o backend Rust e a interface.
 *
 * Espelha `crates/elo-core/src/errors.rs`. A lista de códigos é fechada: um
 * código desconhecido vindo do backend é normalizado para `UNKNOWN` pela camada
 * de IPC, nunca propagado como `undefined`.
 *
 * Referência: docs/04-CONTRATOS-IPC.md §5.
 */

export const ERROR_CODES = [
  'PERMISSION_DENIED',
  'PATH_NOT_ALLOWED',
  'FILE_IN_USE',
  'BROWSER_RUNNING',
  'OPERATION_CANCELLED',
  'RESTORE_POINT_FAILED',
  'REGISTRY_ACCESS_FAILED',
  'UNSUPPORTED_SYSTEM',
  'INSUFFICIENT_DISK_SPACE',
  'INVALID_CONFIGURATION',
  'BACKUP_FAILED',
  'CLEANUP_PARTIALLY_COMPLETED',
  'SERVICE_UNAVAILABLE',
  'CONFIRMATION_REQUIRED',
  'CONFIRMATION_EXPIRED',
  'PROTECTED_RESOURCE',
  'PROCESS_IDENTITY_MISMATCH',
  'ELEVATION_CANCELLED',
  'DATABASE_ERROR',
  'CONTRACT_MISMATCH',
  'BACKEND_UNAVAILABLE',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Erro tipado que a interface recebe. Nunca contém stack trace destinado ao
 * usuário comum: `technicalDetails` só é exibido atrás de "Ver detalhes".
 */
export interface OperationError {
  code: ErrorCode;
  /** Mensagem amigável em pt-BR, sem jargão técnico. */
  message: string;
  /** Detalhes técnicos — exibidos apenas no modo avançado. */
  technicalDetails: string | null;
  /** Possível solução, quando existe uma ação clara para o usuário. */
  suggestion: string | null;
  /** Indica se faz sentido oferecer "Tentar novamente". */
  retryable: boolean;
  /** Correlaciona com a linha do log técnico. Sempre visível e copiável. */
  diagnosticId: string;
  /** Contexto adicional já redigido (sem dados pessoais). */
  context?: Record<string, string>;
}

/** Erro de aplicação em forma de `Error`, para uso com `throw`/`catch`. */
export class EloError extends Error {
  readonly operationError: OperationError;

  constructor(operationError: OperationError) {
    super(operationError.message);
    this.name = 'EloError';
    this.operationError = operationError;
  }

  get code(): ErrorCode {
    return this.operationError.code;
  }

  get diagnosticId(): string {
    return this.operationError.diagnosticId;
  }

  get retryable(): boolean {
    return this.operationError.retryable;
  }
}

export function isEloError(value: unknown): value is EloError {
  return value instanceof EloError;
}
