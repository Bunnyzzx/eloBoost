import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageTransition } from '@/components/motion/PageTransition';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerItem } from '@/components/motion/Stagger';
import { Skeleton, SkeletonMeter, SkeletonText } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { useUiStore } from '@/stores/uiStore';

/** Substitui `matchMedia` para simular a preferência do sistema. */
function setSystemReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  setSystemReducedMotion(false);
  useUiStore.getState().setReduceMotion(false);
});

afterEach(() => {
  useUiStore.getState().setReduceMotion(false);
});

describe('PageTransition', () => {
  it('renderiza o conteúdo imediatamente, sem esperar a animação', () => {
    render(
      <PageTransition routeKey="/limpeza">
        <p>Conteúdo da tela</p>
      </PageTransition>,
    );
    expect(screen.getByText('Conteúdo da tela')).toBeInTheDocument();
  });

  it('mantém o conteúdo acessível quando o movimento é reduzido', () => {
    useUiStore.getState().setReduceMotion(true);
    render(
      <PageTransition routeKey="/">
        <p>Ainda visível</p>
      </PageTransition>,
    );
    expect(screen.getByText('Ainda visível')).toBeInTheDocument();
  });
});

describe('StaggerItem', () => {
  it('renderiza o filho independentemente do índice', () => {
    render(
      <>
        <StaggerItem index={0}>
          <p>Primeiro</p>
        </StaggerItem>
        <StaggerItem index={30}>
          <p>Trigésimo</p>
        </StaggerItem>
      </>,
    );

    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Trigésimo')).toBeInTheDocument();
  });
});

describe('Reveal', () => {
  it('mantém o conteúdo visível quando IntersectionObserver não existe', () => {
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error — simula ambiente sem a API para validar o fallback.
    delete globalThis.IntersectionObserver;

    render(
      <Reveal>
        <p>Seção</p>
      </Reveal>,
    );

    expect(screen.getByText('Seção')).toBeVisible();
    globalThis.IntersectionObserver = original;
  });

  it('não esconde conteúdo com movimento reduzido', () => {
    useUiStore.getState().setReduceMotion(true);

    render(
      <Reveal>
        <p>Sempre visível</p>
      </Reveal>,
    );

    const wrapper = screen.getByText('Sempre visível').parentElement;
    expect(wrapper).toHaveAttribute('data-revealed', 'true');
    expect(wrapper).toHaveStyle({ opacity: '1' });
  });

  it('o conteúdo está sempre no DOM, mesmo antes de aparecer', () => {
    render(
      <Reveal>
        <p>Texto indexável</p>
      </Reveal>,
    );
    expect(screen.getByText('Texto indexável')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('anuncia o carregamento para leitores de tela', () => {
    render(<Spinner />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('aceita rótulo personalizado', () => {
    render(<Spinner label="Analisando arquivos" />);
    expect(screen.getByText('Analisando arquivos')).toBeInTheDocument();
  });
});

describe('Skeletons', () => {
  it('o skeleton simples anuncia estado de carregamento', () => {
    render(<Skeleton className="h-4 w-20" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('skeletons compostos anunciam uma única vez', () => {
    render(<SkeletonText lines={4} />);
    // Os blocos internos usam `silent`, então há apenas um `role="status"`.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('o skeleton de indicador também anuncia apenas uma vez', () => {
    render(<SkeletonMeter />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

describe('preferência de movimento reduzido', () => {
  it('a configuração do aplicativo é suficiente para reduzir o movimento', () => {
    useUiStore.getState().setReduceMotion(true);
    expect(useUiStore.getState().reduceMotion).toBe(true);
  });

  it('a preferência do sistema é respeitada mesmo sem a configuração do app', () => {
    setSystemReducedMotion(true);

    render(
      <Reveal>
        <p>Conteúdo</p>
      </Reveal>,
    );

    expect(screen.getByText('Conteúdo').parentElement).toHaveAttribute('data-revealed', 'true');
  });
});
