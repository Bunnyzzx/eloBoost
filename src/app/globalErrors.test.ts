import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installGlobalErrorHandlers, resetGlobalErrorHandlersForTests } from '@/app/globalErrors';
import { useUiStore } from '@/stores/uiStore';

describe('captura global de erros', () => {
  beforeEach(() => {
    resetGlobalErrorHandlersForTests();
    useUiStore.getState().clearToasts();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('converte promessa rejeitada em toast com ID de diagnóstico', () => {
    installGlobalErrorHandlers();

    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new Error('falha assíncrona não tratada');
    window.dispatchEvent(event);

    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.tone).toBe('error');
    expect(toasts[0]?.diagnosticId).toBeTruthy();
  });

  it('não expõe a mensagem crua da exceção ao usuário', () => {
    installGlobalErrorHandlers();

    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new Error('rusqlite::Error na linha 412');
    window.dispatchEvent(event);

    expect(useUiStore.getState().toasts[0]?.title).not.toContain('rusqlite');
  });

  it('preserva o erro tipado vindo do backend', () => {
    installGlobalErrorHandlers();

    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = {
      code: 'PERMISSION_DENIED',
      message: 'O Windows negou acesso a este recurso.',
      technicalDetails: 'ERROR_ACCESS_DENIED (5)',
      suggestion: 'Execute a ação com permissão de administrador.',
      retryable: true,
      diagnosticId: 'op-999',
    };
    window.dispatchEvent(event);

    const toast = useUiStore.getState().toasts[0];
    expect(toast?.title).toBe('O Windows negou acesso a este recurso.');
    expect(toast?.description).toBe('Execute a ação com permissão de administrador.');
    expect(toast?.diagnosticId).toBe('op-999');
  });

  it('erros permanecem na tela até o usuário dispensar', () => {
    installGlobalErrorHandlers();

    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new Error('qualquer');
    window.dispatchEvent(event);

    // `durationMs: null` = não some sozinho; o ID precisa ficar disponível para cópia.
    expect(useUiStore.getState().toasts[0]?.durationMs).toBeNull();
  });

  it('instala os ouvintes apenas uma vez', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');

    installGlobalErrorHandlers();
    const primeiraChamada = addEventListener.mock.calls.length;
    installGlobalErrorHandlers();

    expect(addEventListener.mock.calls.length).toBe(primeiraChamada);
    addEventListener.mockRestore();
  });

  it('ignora falhas de carregamento de recurso, que não têm exceção associada', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(new Event('error'));

    expect(useUiStore.getState().toasts).toHaveLength(0);
  });
});
