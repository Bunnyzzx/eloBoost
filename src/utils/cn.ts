import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compõe classes do Tailwind resolvendo conflitos (a última vence).
 * Usado por todos os componentes do design system para permitir sobrescrita
 * pontual via prop `className` sem duplicar utilitários conflitantes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
