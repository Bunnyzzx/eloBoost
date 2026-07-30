import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Largura máxima do diálogo. */
  size?: 'sm' | 'md' | 'lg';
  /** Impede fechar por Esc ou clique no fundo (operações em andamento). */
  dismissible?: boolean;
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal acessível.
 *
 * Implementa o que docs/08 §6 exige: `role="dialog"`, `aria-modal`, retenção
 * de foco (focus trap), retorno do foco ao gatilho e fechamento por Esc.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Guarda o elemento focado antes de abrir e o restaura ao fechar.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? dialogRef.current)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable == null || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first == null || last == null) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [open, dismissible, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 grid place-items-center p-6">
          <motion.div
            className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismissible ? onClose : undefined}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description != null ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'relative flex max-h-[85vh] w-full flex-col',
              'rounded-modal border border-strong bg-surface shadow-elo-lg',
              SIZES[size],
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold text-fg">
                  {title}
                </h2>
                {description != null && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-fg-secondary">
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mt-1 -mr-2 shrink-0 px-2"
                >
                  <X aria-hidden className="size-4" />
                </Button>
              )}
            </div>

            {children != null && (
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
            )}

            {footer != null && (
              <div className="flex items-center justify-end gap-3 border-t border-subtle px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
