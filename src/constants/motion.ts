/**
 * Tokens de movimento do eloBoost — fonte única de duração, easing e
 * intensidade.
 *
 * Os mesmos números existem em `src/styles/theme.css` como custom properties,
 * para o que é feito em CSS puro. Este módulo é a versão consumível pelo
 * JavaScript (Framer Motion). Alterar um valor aqui exige alterar o token CSS
 * correspondente — o teste `motion.test.ts` verifica que os dois não divergem.
 *
 * Princípios (definidos pelo produto):
 *   • 120–250 ms. Nada mais lento: o app precisa parecer imediato.
 *   • Um único easing de saída para tudo, para o movimento parecer de um só
 *     sistema.
 *   • Deslocamentos de no máximo 8 px e escala de no máximo 2%. Sem zoom forte,
 *     sem partículas, sem nada que lembre um launcher de jogos.
 *   • Nenhuma animação comunica estado sozinha — sempre há texto ou ícone.
 */

/** Durações em milissegundos. */
export const DURATION = {
  /** Feedback imediato: hover, pressionar, troca de cor. */
  instant: 120,
  /** Padrão: entrada de elemento, fade, transição de página. */
  base: 180,
  /** Movimentos maiores: recolher a barra lateral, abrir modal. */
  slow: 240,
} as const;

/** Durações em segundos, como o Framer Motion espera. */
export const DURATION_S = {
  instant: DURATION.instant / 1000,
  base: DURATION.base / 1000,
  slow: DURATION.slow / 1000,
} as const;

/**
 * Curva de easing padrão — desaceleração suave, sem overshoot.
 * Equivale a `cubic-bezier(0.2, 0, 0, 1)` no CSS.
 */
export const EASE: readonly [number, number, number, number] = [0.2, 0, 0, 1];

/** Intensidade dos deslocamentos, em pixels. */
export const OFFSET = {
  /** Entrada de item em lista ou card. */
  subtle: 6,
  /** Entrada de página e de seção. */
  page: 8,
} as const;

/** Atraso entre itens de uma entrada escalonada, em segundos. */
export const STAGGER_STEP_S = 0.04;

/**
 * Número máximo de itens escalonados; além disso o atraso deixa de crescer.
 *
 * Seis itens × 40 ms = 240 ms de atraso máximo. Somado à duração da entrada, a
 * última animação da página termina em 420 ms — abaixo do limiar em que uma
 * abertura de tela começa a parecer lenta.
 */
export const STAGGER_MAX_ITEMS = 6;

/**
 * Atraso de um item na entrada escalonada.
 *
 * O teto evita que o sétimo card espere o mesmo tempo que o trigésimo numa
 * lista longa — o que faria a página parecer lenta em vez de fluida.
 */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_STEP_S;
}

/** Transição padrão para uso direto em componentes Framer. */
export const TRANSITION = {
  duration: DURATION_S.base,
  ease: EASE,
} as const;

export const TRANSITION_INSTANT = {
  duration: DURATION_S.instant,
  ease: EASE,
} as const;

/** Entrada com fade e deslocamento vertical sutil. */
export const fadeUp = {
  hidden: { opacity: 0, y: OFFSET.subtle },
  visible: { opacity: 1, y: 0 },
} as const;

/** Entrada de página: mesmo fade, deslocamento um pouco maior. */
export const pageEnter = {
  hidden: { opacity: 0, y: OFFSET.page },
  visible: { opacity: 1, y: 0 },
} as const;

/** Fade puro, para quando qualquer deslocamento causaria salto de layout. */
export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;

/**
 * Variantes equivalentes sem deslocamento, usadas quando o usuário pediu
 * redução de movimento. O elemento ainda aparece — apenas sem se mover.
 */
export const reducedVariants = fade;
