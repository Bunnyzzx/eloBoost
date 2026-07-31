import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeError } from '@/services/ipc';
import {
  listScanCategories,
  onCategoryScanned,
  scanComputer,
  scanProgress,
} from '@/services/scannerService';
import type { OperationError } from '@/types/errors';
import type { CategoryScan, ScanCategoryId, ScanSummary } from '@/types/scanner';

export type ScanPhase = 'idle' | 'preparing' | 'running' | 'done' | 'error';

export interface ScanState {
  phase: ScanPhase;
  /**
   * Uma entrada por categoria conhecida, na ordem do backend.
   *
   * Durante a análise, as categorias já concluídas trazem números reais e as
   * pendentes continuam com os metadados iniciais — é o que permite mostrar
   * "✓ Lixeira" ao lado de "⏳ Downloads".
   */
  categories: CategoryScan[];
  /** Quais categorias já responderam. */
  finished: ReadonlySet<ScanCategoryId>;
  /** 0 a 100, por categorias concluídas. */
  progress: number;
  /** Só existe quando a análise inteira terminou. */
  summary: ScanSummary | null;
  error: OperationError | null;
  start: () => void;
}

/**
 * Estado da tela de análise.
 *
 * O desenho central: os eventos de progresso preenchem os cards conforme
 * chegam, mas **o resumo devolvido pelo comando é a fonte de verdade**. Se um
 * evento se perder, o card fica pendente por alguns instantes e é corrigido no
 * fim — em vez de a tela ficar eternamente incompleta.
 *
 * A assinatura de eventos é montada **antes** de disparar o comando: assinar
 * depois abriria uma janela em que as categorias mais rápidas já teriam
 * terminado e seus eventos se perderiam.
 */
export function useScan(): ScanState {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [categories, setCategories] = useState<CategoryScan[]>([]);
  const [finished, setFinished] = useState<ReadonlySet<ScanCategoryId>>(new Set());
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<OperationError | null>(null);

  // Identifica a execução atual: uma análise anterior que ainda esteja
  // resolvendo não pode sobrescrever o estado da nova.
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lista inicial: os cards existem antes da primeira análise, em estado vazio.
  useEffect(() => {
    let cancelled = false;

    listScanCategories().then(
      (initial) => {
        if (!cancelled) setCategories(initial);
      },
      () => {
        // Falhar aqui não impede analisar: o comando de análise devolve as
        // categorias de qualquer forma. A tela só começa sem os cards vazios.
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(() => {
    const run = runRef.current + 1;
    runRef.current = run;

    setPhase('preparing');
    setError(null);
    setSummary(null);
    setFinished(new Set());

    const isStale = () => !mountedRef.current || runRef.current !== run;

    const unsubscribe = onCategoryScanned((scan) => {
      if (isStale()) return;

      setPhase('running');
      setCategories((current) => {
        const index = current.findIndex((item) => item.category === scan.category);
        if (index === -1) return [...current, scan];

        const next = [...current];
        next[index] = scan;
        return next;
      });
      setFinished((current) => new Set(current).add(scan.category));
    });

    scanComputer()
      .then(
        (result) => {
          if (isStale()) return;

          // O relatório final substitui o que veio por evento — inclusive
          // preenchendo categorias cujo evento se perdeu.
          setCategories(result.categories);
          setFinished(new Set(result.categories.map((scan) => scan.category)));
          setSummary(result);
          setPhase('done');
        },
        (cause: unknown) => {
          if (isStale()) return;
          setError(normalizeError(cause));
          setPhase('error');
        },
      )
      .finally(unsubscribe);
  }, []);

  return {
    phase,
    categories,
    finished,
    progress: scanProgress(finished.size, categories.length),
    summary,
    error,
    start,
  };
}
