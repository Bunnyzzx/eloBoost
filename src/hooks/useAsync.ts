import { useCallback, useEffect, useState } from 'react';

import { normalizeError } from '@/services/ipc';
import type { OperationError } from '@/types/errors';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncResult<T> {
  /** `loading` apenas na primeira carga; recargas mantêm `success`. */
  status: AsyncStatus;
  data: T | null;
  error: OperationError | null;
  /** `true` durante uma recarga que já tem dados anteriores na tela. */
  isRefreshing: boolean;
  /** Reexecuta a chamada preservando os dados atuais. */
  reload: () => void;
}

interface Settled<T> {
  /** Qual execução produziu este resultado. */
  nonce: number;
  data: T | null;
  error: OperationError | null;
}

/**
 * Executa uma chamada assíncrona ao backend expondo os estados que toda tela
 * precisa tratar: carregando, sucesso, erro e atualizando (docs/08 §5).
 *
 * Diferença importante em relação a um `useAsync` ingênuo: numa recarga, os
 * dados anteriores **permanecem na tela** e `isRefreshing` fica `true`. Trocar
 * um dashboard preenchido por skeletons a cada atualização seria uma regressão
 * visual — o usuário perde o contexto e a tela "pisca".
 *
 * Qualquer rejeição é normalizada para `OperationError`, então a interface nunca
 * lida com `unknown` vindo de um `catch`.
 *
 * `fn` precisa ser uma referência estável — uma função de módulo (como as de
 * `services/`) ou memoizada com `useCallback`.
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

  // Estado derivado: enquanto o resultado não corresponder à execução atual, a
  // chamada está em andamento. Evita um setState síncrono dentro do efeito.
  const isCurrent = settled.nonce === nonce;
  const hasPreviousData = settled.data != null;

  const status: AsyncStatus = isCurrent
    ? settled.error != null
      ? 'error'
      : 'success'
    : // Recarga com dados na tela continua "success"; só a primeira carga mostra
      // o esqueleto.
      hasPreviousData
      ? 'success'
      : 'loading';

  return {
    status,
    // Os dados anteriores seguem visíveis durante a recarga.
    data: settled.data,
    error: isCurrent ? settled.error : null,
    isRefreshing: !isCurrent && hasPreviousData,
    reload,
  };
}
