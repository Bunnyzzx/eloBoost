import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

describe('Modal', () => {
  it('não renderiza nada quando fechado', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Revisar limpeza" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('expõe role, aria-modal e título acessível', () => {
    render(<Modal open onClose={vi.fn()} title="Revisar limpeza" />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Revisar limpeza' })).toBeInTheDocument();
  });

  it('associa a descrição via aria-describedby', () => {
    render(
      <Modal open onClose={vi.fn()} title="Título" description="Serão removidos 10 arquivos." />,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Serão removidos 10 arquivos.',
    );
  });

  it('fecha com Esc quando dispensável', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Título" />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignora Esc quando não é dispensável (operação em andamento)', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Limpando" dismissible={false} />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
  });

  it('mantém o foco dentro do diálogo ao tabular', async () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Título"
        footer={
          <>
            <Button variant="secondary">Cancelar</Button>
            <Button>Confirmar</Button>
          </>
        }
      />,
    );

    const dialog = screen.getByRole('dialog');
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });

    confirmar.focus();
    await userEvent.tab();

    // Após o último elemento, o foco volta para dentro do diálogo, não para o corpo.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('move o foco para o primeiro elemento focável ao abrir', () => {
    render(
      <Modal open onClose={vi.fn()} title="Título" footer={<Button>Confirmar</Button>} />,
    );
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});
