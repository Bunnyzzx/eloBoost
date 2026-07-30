import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renderiza um <button> real, acessível por papel', () => {
    render(<Button>Analisar computador</Button>);
    expect(screen.getByRole('button', { name: 'Analisar computador' })).toBeInTheDocument();
  });

  it('usa type="button" por padrão para não submeter formulários por engano', () => {
    render(<Button>Ação</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Limpar</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('é acionável pelo teclado', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Limpar</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('bloqueia o clique enquanto carrega e anuncia aria-busy', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Analisando
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('não dispara quando desabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Indisponível
      </Button>,
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
