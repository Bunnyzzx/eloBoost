/**
 * Camada de IPC — a ÚNICA parte da interface autorizada a chamar `invoke`.
 *
 * Responsabilidades:
 *  1. Chamar comandos Tauri nomeados (nunca comandos genéricos — docs/05).
 *  2. Validar a resposta contra o schema Zod correspondente.
 *  3. Normalizar qualquer falha para `EloError`, com código, mensagem
 *     amigável, sugestão e ID de diagnóstico.
 *
 * O ESLint impede `import { invoke }` em qualquer outro arquivo
 * (regra `no-restricted-imports` em eslint.config.js).
 */

import { invoke } from '@tauri-apps/api/core';
import type { z } from 'zod';

import { operationErrorSchema } from '@/schemas';
import { type ErrorCode, EloError, type OperationError } from '@/types/errors';

/**
 * Detecta se estamos rodando dentro do Tauri.
 *
 * A interface também roda em navegador puro durante o desenvolvimento
 * (`npm run dev` sem o Tauri) — nesse caso, chamadas de backend falham com
 * `BACKEND_UNAVAILABLE` de forma explícita, em vez de travar em silêncio.
 */
export function isTauriAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/** Gera um ID de diagnóstico local quando o backend não forneceu um. */
function localDiagnosticId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return `ui-${cryptoRef.randomUUID()}`;
  }
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Mensagens padrão para erros que nascem na própria interface. */
const UI_ERROR_DEFAULTS: Record<
  Extract<ErrorCode, 'BACKEND_UNAVAILABLE' | 'CONTRACT_MISMATCH' | 'UNKNOWN'>,
  { message: string; suggestion: string; retryable: boolean }
> = {
  BACKEND_UNAVAILABLE: {
    message: 'O núcleo do eloBoost não está disponível.',
    suggestion:
      'Esta funcionalidade precisa do aplicativo instalado. No navegador, apenas a interface é exibida.',
    retryable: false,
  },
  CONTRACT_MISMATCH: {
    message: 'A resposta recebida do aplicativo não pôde ser interpretada.',
    suggestion: 'Atualize o eloBoost para a versão mais recente.',
    retryable: false,
  },
  UNKNOWN: {
    message: 'Ocorreu um erro inesperado.',
    suggestion: 'Tente novamente. Se o problema persistir, informe o ID de diagnóstico.',
    retryable: true,
  },
};

/** Constrói um `OperationError` originado na interface. */
export function makeUiError(
  code: keyof typeof UI_ERROR_DEFAULTS,
  technicalDetails?: string,
): OperationError {
  const preset = UI_ERROR_DEFAULTS[code];
  return {
    code,
    message: preset.message,
    technicalDetails: technicalDetails ?? null,
    suggestion: preset.suggestion,
    retryable: preset.retryable,
    diagnosticId: localDiagnosticId(),
  };
}

/**
 * Converte o que quer que o backend (ou o runtime) tenha rejeitado em um
 * `OperationError` válido. Nunca lança.
 */
export function normalizeError(raw: unknown): OperationError {
  if (raw instanceof EloError) return raw.operationError;

  const parsed = operationErrorSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  if (raw instanceof Error) {
    return {
      ...makeUiError('UNKNOWN', raw.stack ?? raw.message),
      message: UI_ERROR_DEFAULTS.UNKNOWN.message,
    };
  }

  if (typeof raw === 'string') {
    return makeUiError('UNKNOWN', raw);
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    serialized = String(raw);
  }
  return makeUiError('UNKNOWN', serialized);
}

/**
 * Chama um comando Tauri nomeado e valida a resposta.
 *
 * @param command  Nome exato do comando registrado no backend.
 * @param schema   Schema Zod que descreve a resposta esperada.
 * @param args     Argumentos do comando (já tipados pelo serviço chamador).
 */
export async function invokeCommand<TSchema extends z.ZodTypeAny>(
  command: string,
  schema: TSchema,
  args?: Record<string, unknown>,
): Promise<z.infer<TSchema>> {
  if (!isTauriAvailable()) {
    throw new EloError(makeUiError('BACKEND_UNAVAILABLE', `comando indisponível: ${command}`));
  }

  let raw: unknown;
  try {
    raw = await invoke(command, args);
  } catch (cause) {
    throw new EloError(normalizeError(cause));
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new EloError(
      makeUiError(
        'CONTRACT_MISMATCH',
        `resposta inválida de "${command}": ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
          .join('; ')}`,
      ),
    );
  }

  return parsed.data;
}
