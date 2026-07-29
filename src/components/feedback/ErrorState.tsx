import { AlertOctagon, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import type { OperationError } from '@/types/errors';
import { cn } from '@/utils/cn';

export interface ErrorStateProps {
  error: OperationError;
  onRetry?: () => void;
  /** Exibe o bloco de detalhes técnicos (modo avançado). */
  showTechnicalDetails?: boolean;
  className?: string;
}

/**
 * Apresentação de erro para o usuário.
 *
 * Regra (docs/04 §5): o usuário comum vê mensagem amigável, sugestão e o ID de
 * diagnóstico. Detalhes técnicos ficam atrás de "Ver detalhes" — nunca um
 * stack trace jogado na tela.
 */
export function ErrorState({
  error,
  onRetry,
  showTechnicalDetails = false,
  className,
}: ErrorStateProps) {
  const [expanded, setExpanded] = useState(showTechnicalDetails);
  const [copied, setCopied] = useState(false);

  async function copyDiagnosticId() {
    try {
      await navigator.clipboard.writeText(error.diagnosticId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Área de transferência indisponível: o ID continua visível e selecionável.
      setCopied(false);
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-card border border-critical/35 bg-critical-soft p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 shrink-0 text-critical">
          <AlertOctagon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">{error.message}</h3>

          {error.suggestion != null && (
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-fg-secondary">
              {error.suggestion}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry != null && error.retryable && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRetry}
                iconStart={<RefreshCw className="size-3.5" />}
              >
                Tentar novamente
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => void copyDiagnosticId()}
              iconStart={<Copy className="size-3.5" />}
            >
              {copied ? 'ID copiado' : 'Copiar ID de diagnóstico'}
            </Button>

            {error.technicalDetails != null && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </Button>
            )}
          </div>

          <p className="mt-3 font-mono text-[0.6875rem] text-fg-muted selectable">
            {error.code} · {error.diagnosticId}
          </p>

          {expanded && error.technicalDetails != null && (
            <pre
              className={cn(
                'mt-2 max-h-48 overflow-auto rounded-[8px] border border-subtle bg-base p-3',
                'font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-fg-secondary selectable',
              )}
            >
              {error.technicalDetails}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
