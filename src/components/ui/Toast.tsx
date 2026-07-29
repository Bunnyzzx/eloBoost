import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { useUiStore, type Toast as ToastData, type ToastTone } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const TONE_CONFIG: Record<ToastTone, { icon: ReactNode; accent: string; role: 'status' | 'alert' }> =
  {
    info: { icon: <Info className="size-4" />, accent: 'text-accent', role: 'status' },
    success: {
      icon: <CheckCircle2 className="size-4" />,
      accent: 'text-ok',
      role: 'status',
    },
    warning: {
      icon: <AlertTriangle className="size-4" />,
      accent: 'text-attention',
      role: 'alert',
    },
    error: { icon: <XCircle className="size-4" />, accent: 'text-critical', role: 'alert' },
  };

function ToastItem({ toast }: { toast: ToastData }) {
  const dismissToast = useUiStore((state) => state.dismissToast);
  const config = TONE_CONFIG[toast.tone];

  useEffect(() => {
    if (toast.durationMs == null) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismissToast]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3',
        'rounded-card border border-strong bg-elevated p-3.5 shadow-elo-lg',
      )}
    >
      <span aria-hidden className={cn('mt-0.5 shrink-0', config.accent)}>
        {config.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description != null && (
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-fg-secondary">
            {toast.description}
          </p>
        )}
        {toast.diagnosticId != null && (
          <p className="mt-1.5 font-mono text-[0.6875rem] text-fg-muted selectable">
            ID: {toast.diagnosticId}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dispensar notificação"
        className="-mt-1 -mr-1 shrink-0 rounded-[6px] p-1 text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </motion.li>
  );
}

/**
 * Região de toasts.
 *
 * `aria-live="polite"` para notificações comuns; toasts de erro usam
 * `role="alert"` individualmente, para serem anunciados imediatamente.
 */
export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <ul
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-5 bottom-5 z-100 flex flex-col-reverse gap-2.5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
