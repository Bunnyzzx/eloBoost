import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { normalizeError } from '@/services/ipc';
import type { OperationError } from '@/types/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rótulo da área protegida — aparece nos detalhes técnicos. */
  area?: string;
}

interface ErrorBoundaryState {
  error: OperationError | null;
}

/**
 * Barreira de erro global.
 *
 * Impede que uma exceção de renderização derrube a janela inteira: a área
 * afetada é substituída por um `ErrorState` com ID de diagnóstico, e o resto
 * do aplicativo continua utilizável.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: normalizeError(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Substituído pelo serviço de logging estruturado no Épico 0/F-08 do backend.
    console.error('[eloBoost] erro de renderização', {
      area: this.props.area ?? 'desconhecida',
      error,
      componentStack: info.componentStack,
    });
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error == null) return this.props.children;

    return (
      <div className="p-8">
        <ErrorState
          error={{
            ...error,
            message: 'Algo deu errado ao exibir esta parte do eloBoost.',
            suggestion: 'Tente novamente. O restante do aplicativo continua disponível.',
            retryable: true,
          }}
          onRetry={this.handleRetry}
        />
      </div>
    );
  }
}
