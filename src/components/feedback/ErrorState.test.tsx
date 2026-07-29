import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from '@/components/feedback/ErrorState';
import type { OperationError } from '@/types/errors';

const baseError: OperationError = {
  code: 'FILE_IN_USE',
  message: 'Alguns arquivos estão em uso e foram ignorados.',
  technicalDetails: 'ERROR_SHARING_VIOLATION (32) em \\Temp\\arquivo.tmp',
  suggestion: 'Feche os programas relacionados e analise novamente.',
  retryable: true,
  diagnosticId: 'op-abc-123',
};

describe('ErrorState', () => {
  it('anuncia o erro para leitores de tela', () => {
    render(<ErrorState error={baseError} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('mostra mensagem amigável, sugestão e ID de diagnóstico', () => {
    render(<ErrorState error={baseError} />);

    expect(screen.getByText(baseError.message)).toBeInTheDocument();
    expect(screen.getByText(baseError.suggestion!)).toBeInTheDocument();
    expect(screen.getByText(/op-abc-123/)).toBeInTheDocument();
  });

  it('esconde os detalhes técnicos até o usuário pedir', async () => {
    render(<ErrorState error={baseError} />);

    expect(screen.queryByText(/ERROR_SHARING_VIOLATION/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(screen.getByText(/ERROR_SHARING_VIOLATION/)).toBeInTheDocument();
  });

  it('oferece "Tentar novamente" apenas quando o erro é retentável', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState error={baseError} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();

    rerender(<ErrorState error={{ ...baseError, retryable: false }} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).not.toBeInTheDocument();
  });

  it('chama onRetry ao clicar', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={baseError} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('não quebra quando a área de transferência não está disponível', async () => {
    render(<ErrorState error={baseError} />);
    const copyButton = screen.getByRole('button', { name: /Copiar ID de diagnóstico/ });

    await expect(userEvent.click(copyButton)).resolves.not.toThrow();
  });
});
