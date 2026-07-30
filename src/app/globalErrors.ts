/**
 * Captura global de erros não tratados.
 *
 * O `ErrorBoundary` cobre erros de renderização; este módulo cobre o resto:
 * promessas rejeitadas sem `catch` e exceções fora do React. Ambos viram um
 * toast com ID de diagnóstico, em vez de sumirem no console.
 */

import { normalizeError } from '@/services/ipc';
import { useUiStore } from '@/stores/uiStore';

let installed = false;

function report(raw: unknown, origin: string): void {
  const error = normalizeError(raw);

  useUiStore.getState().pushToast({
    tone: 'error',
    title: error.message,
    description: error.suggestion ?? undefined,
    diagnosticId: error.diagnosticId,
  });

  console.error(`[eloBoost] ${origin}`, {
    code: error.code,
    diagnosticId: error.diagnosticId,
    technicalDetails: error.technicalDetails,
  });
}

export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    report(event.reason, 'promessa rejeitada sem tratamento');
  });

  window.addEventListener('error', (event) => {
    // Erros de carregamento de recurso (img, script) não têm `error` associado.
    if (event.error == null) return;
    report(event.error, 'erro não capturado');
  });
}

/** Exposto para os testes poderem reinstalar os handlers em um DOM novo. */
export function resetGlobalErrorHandlersForTests(): void {
  installed = false;
}
