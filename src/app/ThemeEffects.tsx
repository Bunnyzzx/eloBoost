import { useEffect } from 'react';

import { useUiStore } from '@/stores/uiStore';

/**
 * Aplica as preferências de interface no elemento raiz.
 *
 * Concentrar isso num único lugar mantém os componentes livres de lógica de
 * tema: eles apenas usam os tokens, que mudam de valor conforme os atributos
 * definidos aqui.
 */
export function ThemeEffects() {
  const theme = useUiStore((state) => state.theme);
  const reduceMotion = useUiStore((state) => state.reduceMotion);
  const uiScale = useUiStore((state) => state.uiScale);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset['reduceMotion'] = String(reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.style.setProperty('--elo-ui-scale', String(uiScale));
  }, [uiScale]);

  // Respeita a preferência do sistema na primeira carga, sem sobrescrever uma
  // escolha explícita do usuário depois disso.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (query.matches) {
      useUiStore.getState().setReduceMotion(true);
    }
  }, []);

  return null;
}
