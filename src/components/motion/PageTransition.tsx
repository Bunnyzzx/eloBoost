import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { fade, pageEnter, TRANSITION } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface PageTransitionProps {
  /** Chave que identifica a tela — normalmente o pathname. */
  routeKey: string;
  children: ReactNode;
}

/**
 * Transição de entrada de página: fade curto com deslocamento vertical sutil.
 *
 * Decisão deliberada: **não há animação de saída.** Animar a saída exigiria
 * manter a tela antiga montada enquanto a nova entra (`AnimatePresence`), o que
 * na prática produz piscada, salto de rolagem e — pior — dois componentes
 * montados chamando o backend ao mesmo tempo. Trocando a `key`, o React
 * substitui a árvore e apenas a tela nova é animada. A navegação continua
 * instantânea.
 *
 * O elemento nunca recebe `pointer-events: none`, então cliques funcionam
 * durante os 180 ms da entrada.
 */
export function PageTransition({ routeKey, children }: PageTransitionProps) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion ? fade : pageEnter;

  return (
    <motion.div
      key={routeKey}
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={TRANSITION}
      // `will-change` só durante a animação seria ideal, mas o custo aqui é
      // desprezível e evita repaint do texto no primeiro frame.
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}
