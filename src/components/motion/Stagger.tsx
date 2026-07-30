import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { fade, fadeUp, staggerDelay, TRANSITION } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/utils/cn';

export interface StaggerItemProps {
  /** Posição na lista — define o atraso da entrada. */
  index: number;
  children: ReactNode;
  className?: string;
}

/**
 * Item de uma entrada escalonada.
 *
 * Cada item entra 40 ms depois do anterior, com teto no sexto — o suficiente
 * para a página parecer viva, sem transformar o carregamento em espetáculo.
 *
 * O atraso é calculado por índice em vez de usar `staggerChildren` do Framer
 * porque os cards não compartilham um pai animado: eles vivem dentro de grids
 * cujo layout não deve ser tocado.
 */
export function StaggerItem({ index, children, className }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={reduceMotion ? fade : fadeUp}
      transition={{ ...TRANSITION, delay: reduceMotion ? 0 : staggerDelay(index) }}
      className={cn('min-w-0', className)}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contêiner opcional para entradas escalonadas.
 *
 * Não anima nada por si: existe apenas para dar um nome à intenção no JSX e
 * manter as classes de grid num só lugar. Os filhos devem ser `StaggerItem`.
 */
export function Stagger({ children, className }: StaggerProps) {
  return <div className={className}>{children}</div>;
}
