import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { invokeCommand, isTauriAvailable, makeUiError, normalizeError } from '@/services/ipc';
import { EloError } from '@/types/errors';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

/** Simula a presença (ou ausência) do runtime do Tauri na janela. */
function setTauriPresent(present: boolean) {
  if (present) {
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
  } else {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
  }
}

const sampleSchema = z.object({ value: z.number() });

beforeEach(() => {
  invokeMock.mockReset();
  setTauriPresent(false);
});

describe('isTauriAvailable', () => {
  it('detecta a ausência do runtime', () => {
    expect(isTauriAvailable()).toBe(false);
  });

  it('detecta a presença do runtime', () => {
    setTauriPresent(true);
    expect(isTauriAvailable()).toBe(true);
  });
});

describe('invokeCommand', () => {
  it('falha com BACKEND_UNAVAILABLE fora do Tauri, sem chamar invoke', async () => {
    await expect(invokeCommand('app_get_info', sampleSchema)).rejects.toMatchObject({
      code: 'BACKEND_UNAVAILABLE',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('devolve a resposta validada quando o contrato bate', async () => {
    setTauriPresent(true);
    invokeMock.mockResolvedValue({ value: 42 });

    await expect(invokeCommand('cmd', sampleSchema)).resolves.toEqual({ value: 42 });
    expect(invokeMock).toHaveBeenCalledWith('cmd', undefined);
  });

  it('encaminha os argumentos ao comando', async () => {
    setTauriPresent(true);
    invokeMock.mockResolvedValue({ value: 1 });

    await invokeCommand('cmd', sampleSchema, { scanId: 'abc' });
    expect(invokeMock).toHaveBeenCalledWith('cmd', { scanId: 'abc' });
  });

  it('rejeita resposta fora do contrato com CONTRACT_MISMATCH', async () => {
    setTauriPresent(true);
    invokeMock.mockResolvedValue({ value: 'texto onde deveria haver número' });

    const error = await invokeCommand('cmd', sampleSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EloError);
    expect((error as EloError).code).toBe('CONTRACT_MISMATCH');
    // A divergência precisa ser diagnosticável: o caminho do campo aparece nos detalhes.
    expect((error as EloError).operationError.technicalDetails).toContain('value');
  });

  it('preserva o erro tipado devolvido pelo backend', async () => {
    setTauriPresent(true);
    invokeMock.mockRejectedValue({
      code: 'PERMISSION_DENIED',
      message: 'O Windows negou acesso a este recurso.',
      technicalDetails: 'ERROR_ACCESS_DENIED (5)',
      suggestion: 'Execute a ação com permissão de administrador.',
      retryable: true,
      diagnosticId: 'op-123',
    });

    const error = (await invokeCommand('cmd', sampleSchema).catch((e: unknown) => e)) as EloError;
    expect(error.code).toBe('PERMISSION_DENIED');
    expect(error.diagnosticId).toBe('op-123');
    expect(error.retryable).toBe(true);
  });
});

describe('normalizeError', () => {
  it('reconhece um OperationError bem formado', () => {
    const raw = {
      code: 'FILE_IN_USE',
      message: 'Alguns arquivos estão em uso.',
      technicalDetails: null,
      suggestion: 'Feche os programas relacionados.',
      retryable: true,
      diagnosticId: 'op-1',
    };
    expect(normalizeError(raw).code).toBe('FILE_IN_USE');
  });

  it('normaliza um código desconhecido para UNKNOWN em vez de propagá-lo', () => {
    const result = normalizeError({
      code: 'CODIGO_QUE_NAO_EXISTE',
      message: 'x',
      technicalDetails: null,
      suggestion: null,
      retryable: false,
      diagnosticId: 'op-2',
    });
    expect(result.code).toBe('UNKNOWN');
  });

  it('normaliza Error nativo sem expor a mensagem crua ao usuário', () => {
    const result = normalizeError(new Error('falha interna com detalhe técnico'));
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).not.toContain('detalhe técnico');
    expect(result.technicalDetails).toContain('detalhe técnico');
  });

  it('normaliza string e valores arbitrários', () => {
    expect(normalizeError('erro em texto').technicalDetails).toBe('erro em texto');
    expect(normalizeError({ qualquer: 'coisa' }).code).toBe('UNKNOWN');
  });

  it('lida com estruturas circulares sem lançar', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => normalizeError(circular)).not.toThrow();
  });

  it('sempre produz um ID de diagnóstico', () => {
    expect(normalizeError(null).diagnosticId).toBeTruthy();
  });
});

describe('makeUiError', () => {
  it('produz erro com mensagem amigável e sugestão', () => {
    const error = makeUiError('BACKEND_UNAVAILABLE');
    expect(error.message).toBeTruthy();
    expect(error.suggestion).toBeTruthy();
    expect(error.retryable).toBe(false);
  });
});
