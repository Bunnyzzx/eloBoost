import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { normalizeError } from '@/services/ipc';
import {
  cleanProgressPercent,
  defaultSelection,
  executeClean,
  onCategoryCleaned,
  onCleanProgress,
  previewClean,
  selectionTotals,
} from '@/services/cleanerService';
import type { CategoryCleanResult, CleanPreview, CleanReport, CleanStatus } from '@/types/cleaner';
import type { OperationError } from '@/types/errors';
import type { ScanCategoryId } from '@/types/scanner';

/**
 * Fases da tela de limpeza.
 *
 * A ordem é uma via de mão única até o fim: `idle → previewing → ready →
 * cleaning → done`. Não existe transição que pule a prévia, nem no estado da
 * tela nem no backend — que também recusa uma execução sem confirmação.
 */
export type CleanupPhase = 'idle' | 'previewing' | 'ready' | 'cleaning' | 'done' | 'error';

export interface CleanupState {
  phase: CleanupPhase;
  preview: CleanPreview | null;
  /** Categorias marcadas pelo usuário. */
  selected: ReadonlySet<ScanCategoryId>;
  /** Estado ao vivo de cada categoria durante a limpeza. */
  progress: ReadonlyMap<ScanCategoryId, CategoryCleanResult>;
  /** 0 a 100, por categorias concluídas. */
  percent: number;
  report: CleanReport | null;
  error: OperationError | null;
  /** Totais da seleção atual, prontos para a confirmação. */
  totals: { bytes: number; files: number; categories: number };
  analyze: () => void;
  toggle: (category: ScanCategoryId) => void;
  setAll: (checked: boolean) => void;
  clean: () => void;
  reset: () => void;
}

/** Categorias que já terminaram, para o cálculo do progresso. */
function countFinished(progress: ReadonlyMap<ScanCategoryId, CategoryCleanResult>): number {
  let finished = 0;
  for (const result of progress.values()) {
    if (result.status !== 'pending' && result.status !== 'running') finished += 1;
  }
  return finished;
}

/**
 * Estado da tela de limpeza.
 *
 * As assinaturas de evento são montadas **antes** de disparar a execução:
 * assinar depois abriria uma janela em que as categorias mais rápidas já teriam
 * terminado. O relatório devolvido pelo comando continua sendo a fonte de
 * verdade e corrige qualquer evento perdido.
 */
export function useCleanup(): CleanupState {
  const [phase, setPhase] = useState<CleanupPhase>('idle');
  const [preview, setPreview] = useState<CleanPreview | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<ScanCategoryId>>(new Set());
  const [progress, setProgress] = useState<ReadonlyMap<ScanCategoryId, CategoryCleanResult>>(
    new Map(),
  );
  const [report, setReport] = useState<CleanReport | null>(null);
  const [error, setError] = useState<OperationError | null>(null);

  const runRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const analyze = useCallback(() => {
    const run = runRef.current + 1;
    runRef.current = run;

    setPhase('previewing');
    setError(null);
    setReport(null);
    setProgress(new Map());

    previewClean().then(
      (result) => {
        if (!mountedRef.current || runRef.current !== run) return;
        setPreview(result);
        setSelected(defaultSelection(result));
        setPhase('ready');
      },
      (cause: unknown) => {
        if (!mountedRef.current || runRef.current !== run) return;
        setError(normalizeError(cause));
        setPhase('error');
      },
    );
  }, []);

  const toggle = useCallback((category: ScanCategoryId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (checked: boolean) => {
      // Marcar tudo nunca inclui uma área não selecionável: a lista vem da
      // prévia, e a prévia já aplicou a política.
      setSelected(checked && preview != null ? defaultSelection(preview) : new Set());
    },
    [preview],
  );

  const clean = useCallback(() => {
    if (preview == null) return;

    const run = runRef.current + 1;
    runRef.current = run;
    const isStale = () => !mountedRef.current || runRef.current !== run;

    const categories = [...selected];

    // Estado inicial: as selecionadas aguardando, as demais fora da limpeza.
    setProgress(
      new Map(
        preview.categories.map((item) => {
          const status: CleanStatus = selected.has(item.category) ? 'pending' : 'skipped';
          return [
            item.category,
            {
              category: item.category,
              name: item.name,
              status,
              removedFiles: 0,
              removedFolders: 0,
              freedBytes: 0,
              skipped: {
                accessDenied: 0,
                inUse: 0,
                pathTooLong: 0,
                alreadyGone: 0,
                links: 0,
                rejectedByGuard: 0,
                otherFailures: 0,
              },
              durationMs: 0,
              message: null,
            },
          ];
        }),
      ),
    );
    setPhase('cleaning');

    const stopCategory = onCategoryCleaned((result) => {
      if (isStale()) return;
      setProgress((current) => new Map(current).set(result.category, result));
    });

    const stopProgress = onCleanProgress((update) => {
      if (isStale()) return;
      setProgress((current) => {
        const existing = current.get(update.category);
        if (existing == null) return current;
        return new Map(current).set(update.category, {
          ...existing,
          status: 'running',
          removedFiles: update.removedFiles,
          freedBytes: update.freedBytes,
        });
      });
    });

    executeClean(preview, categories)
      .then(
        (result) => {
          if (isStale()) return;
          setProgress(new Map(result.categories.map((item) => [item.category, item])));
          setReport(result);
          setPhase('done');
        },
        (cause: unknown) => {
          if (isStale()) return;
          setError(normalizeError(cause));
          setPhase('error');
        },
      )
      .finally(() => {
        stopCategory();
        stopProgress();
      });
  }, [preview, selected]);

  const reset = useCallback(() => {
    runRef.current += 1;
    setPhase('idle');
    setPreview(null);
    setSelected(new Set());
    setProgress(new Map());
    setReport(null);
    setError(null);
  }, []);

  const totals = useMemo(
    () =>
      preview == null ? { bytes: 0, files: 0, categories: 0 } : selectionTotals(preview, selected),
    [preview, selected],
  );

  const percent = useMemo(
    () => cleanProgressPercent(countFinished(progress), selected.size),
    [progress, selected.size],
  );

  return {
    phase,
    preview,
    selected,
    progress,
    percent,
    report,
    error,
    totals,
    analyze,
    toggle,
    setAll,
    clean,
    reset,
  };
}
