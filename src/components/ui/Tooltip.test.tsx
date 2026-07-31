import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from '@/components/ui/Tooltip';

const JANELA = { largura: 1280, altura: 720 };

/** Retângulo do gatilho usado por cada cenário. */
let gatilho = { top: 300, left: 600, width: 80, height: 24 };
/** Tamanho fixo do balão — o jsdom não faz layout, então ele é declarado. */
const BALAO = { width: 240, height: 60 };

function retangulo(x: number, y: number, largura: number, altura: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width: largura,
    height: altura,
    right: x + largura,
    bottom: y + altura,
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  window.innerWidth = JANELA.largura;
  window.innerHeight = JANELA.altura;
  gatilho = { top: 300, left: 600, width: 80, height: 24 };

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'tooltip'
      ? retangulo(0, 0, BALAO.width, BALAO.height)
      : retangulo(gatilho.left, gatilho.top, gatilho.width, gatilho.height);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Posição efetiva do balão, em pixels. */
function posicao() {
  const balao = screen.getByRole('tooltip');
  return {
    top: Number.parseFloat(balao.style.top),
    left: Number.parseFloat(balao.style.left),
  };
}

describe('Tooltip', () => {
  it('só monta o balão quando o gatilho recebe o ponteiro', async () => {
    const user = userEvent.setup();
    render(<Tooltip content="Explicação completa">gatilho</Tooltip>);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByText('gatilho'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explicação completa');

    await user.unhover(screen.getByText('gatilho'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('aparece pelo teclado e se associa ao gatilho por aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa">
        <button type="button">Ajuda</button>
      </Tooltip>,
    );

    await user.tab();

    const balao = screen.getByRole('tooltip');
    const descrito = document.querySelector('[aria-describedby]');
    expect(descrito?.getAttribute('aria-describedby')).toBe(balao.id);
  });

  it('escapa de um ancestral que recorta, em vez de ser cortado por ele', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="overflow-hidden" style={{ overflow: 'hidden' }}>
        <Tooltip content="Explicação completa">gatilho</Tooltip>
      </div>,
    );

    await user.hover(screen.getByText('gatilho'));

    // É este o defeito que o portal corrige: dentro do contêiner recortado, o
    // balão só apareceria pela metade.
    const balao = screen.getByRole('tooltip');
    expect(container.contains(balao)).toBe(false);
    expect(document.body.contains(balao)).toBe(true);
    // Coordenadas de janela, não do card: é o que torna o portal utilizável.
    expect(balao).toHaveClass('fixed');
  });

  it('fica acima do gatilho quando há espaço', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" side="top">
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    // 300 (topo do gatilho) − 8 (respiro) − 60 (altura do balão)
    expect(posicao().top).toBe(232);
  });

  it('vira para baixo quando não cabe acima', async () => {
    gatilho = { top: 10, left: 600, width: 80, height: 24 };
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" side="top">
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    // 10 + 24 (base do gatilho) + 8 (respiro)
    expect(posicao().top).toBe(42);
  });

  it('desliza para dentro quando o balão ultrapassaria a borda direita', async () => {
    // O chip de privilégio no canto do cabeçalho é exatamente este caso.
    gatilho = { top: 20, left: 1200, width: 60, height: 24 };
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" side="bottom">
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    const { left } = posicao();
    expect(left + BALAO.width).toBeLessThanOrEqual(JANELA.largura - 8);
    expect(left).toBeGreaterThanOrEqual(8);
  });

  it('desliza para dentro quando o balão ultrapassaria a borda esquerda', async () => {
    gatilho = { top: 400, left: 4, width: 60, height: 24 };
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" side="top">
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    expect(posicao().left).toBe(8);
  });

  it('mantém o balão inteiro na janela mesmo com o gatilho na quina', async () => {
    gatilho = { top: 700, left: 1270, width: 10, height: 20 };
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" side="right">
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    const { top, left } = posicao();
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(left + BALAO.width).toBeLessThanOrEqual(JANELA.largura - 8);
    expect(top + BALAO.height).toBeLessThanOrEqual(JANELA.altura - 8);
  });

  it('não monta nada quando está desligado', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Explicação completa" disabled>
        gatilho
      </Tooltip>,
    );

    await user.hover(screen.getByText('gatilho'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
