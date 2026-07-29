import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Exibe indicador de carregamento e desabilita o botão. */
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  /** Ocupa toda a largura disponível. */
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover active:brightness-95 shadow-elo-sm',
  secondary:
    'bg-elevated text-fg border border-strong hover:border-accent hover:bg-accent-soft',
  ghost: 'bg-transparent text-fg-secondary hover:bg-accent-soft hover:text-fg',
  danger: 'bg-critical text-white hover:brightness-110 active:brightness-95 shadow-elo-sm',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5 rounded-[6px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-control',
  lg: 'h-12 px-6 text-[0.9375rem] gap-2.5 rounded-control',
};

/**
 * Botão base do design system.
 *
 * Sempre um `<button>` real (nunca `<div onClick>`), para que teclado e
 * leitores de tela funcionem sem trabalho adicional.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconStart,
    iconEnd,
    block = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium',
        'transition-[background-color,border-color,color,filter] duration-150 ease-elo',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
      ) : (
        iconStart != null && (
          <span aria-hidden className="shrink-0">
            {iconStart}
          </span>
        )
      )}
      {children}
      {iconEnd != null && !loading && (
        <span aria-hidden className="shrink-0">
          {iconEnd}
        </span>
      )}
    </button>
  );
});
