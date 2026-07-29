import { useCallback, useEffect, useState } from 'react';

import { normalizeError } from '@/services/ipc';
import type { OperationError } from '@/types/errors';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncResult<T> {
  status: AsyncStatus;
  data: T | null;
  error: OperationError | null;
  /** Reexecuta a chamada — usado pelo botão "Tentar novamente". */
  reload: () => void;
}

interface Settled<T> {
  /** Qual execução produziu este resultado. */
  nonce: number;
  data: T | null;
  error: OperationError | null;
}

/**
 * Executa uma chamada assíncrona ao backend expondo os três estados que toda
 * tela precisa tratar: carregando, sucesso e erro (docs/08 §5).
 *
 * Qualquer rejeição é normalizada para `OperationError`, então a interface
 * nunca lida com `unknown` vindo de um `catch`.
 *
 * `fn` precisa ser uma referência estável — uma função de módulo (como as de
 * `services/`) ou memoizada com `useCallback`. Uma função inline recriada a
 * cada render dispararia a chamada em laço.
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncResult<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ nonce: -1, data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    fn().then(
      (data) => {
        if (!cancelled) setSettled({ nonce, data, error: null });
      },
      (cause: unknown) => {
        if (!cancelled) setSettled({ nonce, data: null, error: normalizeError(cause) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [fn, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // O estado "carregando" é derivado — enquanto o resultado não corresponder à
  // execução atual, a chamada ainda está em andamento. Isso evita um setState
  // síncrono dentro do efeito só para sinalizar carregamento.
  const isCurrent = settled.nonce === nonce;
  const status: AsyncStatus = !isCurrent ? 'loading' : settled.error != null ? 'error' : 'success';

  return {
    status,
    data: isCurrent ? settled.data : null,
    error: isCurrent ? settled.error : null,
    reload,
  };
}
