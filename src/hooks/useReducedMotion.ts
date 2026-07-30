import { useSyncExternalStore } from 'react';

import { useUiStore } from '@/stores/uiStore';

/** Consulta a preferência do sistema, uma única vez por assinatura. */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToSystem(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSystemPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Indica se o movimento deve ser reduzido.
 *
 * Combina duas fontes, e qualquer uma delas basta para desligar o movimento:
 *   1. `prefers-reduced-motion` do sistema operacional;
 *   2. a opção "reduzir animações" das configurações do eloBoost.
 *
 * Componentes usam isto para trocar deslocamento por fade simples. Nenhuma
 * informação depende de animação, então desligar movimento nunca esconde nada.
 */
export function useReducedMotion(): boolean {
  const systemPrefers = useSyncExternalStore(
    subscribeToSystem,
    getSystemPreference,
    () => false, // no servidor / durante hidratação, presume movimento normal
  );
  const appSetting = useUiStore((state) => state.reduceMotion);

  return systemPrefers || appSetting;
}
