import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Meter } from '@/components/ui/Meter';
import { ProgressBar } from '@/components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('expõe os atributos ARIA de progresso', () => {
    render(<ProgressBar value={42} label="Limpeza" />);

    const bar = screen.getByRole('progressbar', { name: 'Limpeza' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '42%');
  });

  it('limita o valor à faixa válida em vez de estourar a barra', () => {
    const { rerender } = render(<ProgressBar value={150} label="x" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '100%');

    rerender(<ProgressBar value={-10} label="x" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0%');
  });

  it('respeita um máximo diferente de 100', () => {
    render(<ProgressBar value={512} max={1024} label="Disco" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '50%');
  });

  it('no modo indeterminado não anuncia um valor falso', () => {
    render(<ProgressBar value={null} label="Analisando" />);

    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('aria-valuetext', 'Em andamento');
  });

  it('só o modo indeterminado tem animação contínua', () => {
    const { container, rerender } = render(<ProgressBar value={50} label="x" />);
    expect(container.querySelector('.elo-indeterminate')).toBeNull();

    rerender(<ProgressBar value={null} label="x" />);
    expect(container.querySelector('.elo-indeterminate')).not.toBeNull();
  });
});

describe('Meter', () => {
  it('exibe o valor formatado junto com a barra', () => {
    render(<Meter label="Memória" value={59} displayValue="9,4 / 16 GB" />);

    expect(screen.getByText('Memória')).toBeInTheDocument();
    expect(screen.getByText('9,4 / 16 GB')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Memória' })).toBeInTheDocument();
  });

  it('métrica indisponível não vira zero por cima — exibe texto explícito', () => {
    render(<Meter label="Temperatura" value={null} />);

    expect(screen.getByText('Informação não suportada neste dispositivo.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('acompanha a cor com um rótulo textual em cada estado de alerta', () => {
    const { rerender } = render(<Meter label="Disco" value={80} />);
    expect(screen.getByText('atenção')).toBeInTheDocument();

    rerender(<Meter label="Disco" value={95} />);
    expect(screen.getByText('crítico')).toBeInTheDocument();

    // Estado normal não precisa de rótulo extra.
    rerender(<Meter label="Disco" value={20} />);
    expect(screen.queryByText('atenção')).not.toBeInTheDocument();
    expect(screen.queryByText('crítico')).not.toBeInTheDocument();
  });

  it('aceita limiares personalizados', () => {
    render(<Meter label="CPU" value={60} thresholds={{ attention: 50, critical: 70 }} />);
    expect(screen.getByText('atenção')).toBeInTheDocument();
  });
});
