import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AboutPage } from '@/pages/about/AboutPage';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

const RUNTIME_INFO = {
  name: 'eloBoost',
  version: '0.1.0',
  buildProfile: 'release',
  target: 'x86_64-windows-windows',
  runningInTauri: true,
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(RUNTIME_INFO);
  (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
});

describe('AboutPage — conteúdo para o usuário', () => {
  it('explica o que o aplicativo é e para qual sistema', async () => {
    render(<AboutPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Sobre o eloBoost' })).toBeInTheDocument();
    expect(screen.getByText('Windows 10 e Windows 11')).toBeInTheDocument();
    expect(await screen.findByText('versão 0.1.0')).toBeInTheDocument();
  });

  it('apresenta os três princípios do produto', () => {
    render(<AboutPage />);

    expect(screen.getByText('Segurança em primeiro lugar')).toBeInTheDocument();
    expect(screen.getByText('Privacidade')).toBeInTheDocument();
    expect(screen.getByText('Transparência')).toBeInTheDocument();
  });

  it('afirma que nenhuma limpeza acontece sem confirmação', () => {
    render(<AboutPage />);
    expect(screen.getByText('Nenhuma limpeza acontece sem a sua confirmação.')).toBeInTheDocument();
  });

  it('afirma que o aplicativo funciona localmente e não envia dados', () => {
    render(<AboutPage />);

    expect(screen.getByText(/ficam aqui e não são enviadas a lugar nenhum/)).toBeInTheDocument();
    expect(screen.getByText(/Nada é compartilhado automaticamente/)).toBeInTheDocument();
  });

  it('afirma que cada limpeza mostra o que será removido', () => {
    render(<AboutPage />);
    expect(
      screen.getByText(/Cada limpeza mostra a lista do que será removido/),
    ).toBeInTheDocument();
  });
});

describe('AboutPage — o que deixou de aparecer', () => {
  it('não expõe diagnóstico técnico do banco de dados', async () => {
    render(<AboutPage />);
    await screen.findByText('versão 0.1.0');

    // Estes dados são de desenvolvedor e vivem no dashboard e nos logs.
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/banco de dados/i);
    expect(texto).not.toMatch(/schema/i);
    expect(texto).not.toMatch(/migration/i);
    expect(texto).not.toMatch(/%APPDATA%/);
    expect(texto).not.toMatch(/alvo do build/i);
  });

  it('não contém promessas negativas sobre desempenho', async () => {
    render(<AboutPage />);
    await screen.findByText('versão 0.1.0');

    // O produto terá otimizações reais; a página fala do que ele faz, não de
    // uma lista do que ele deixa de prometer.
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/FPS/i);
    expect(texto).not.toMatch(/nunca faz/i);
  });

  it('só chama o backend para ler a versão', async () => {
    render(<AboutPage />);
    await screen.findByText('versão 0.1.0');

    const comandos = new Set(invokeMock.mock.calls.map((call) => call[0] as string));
    expect(comandos).toEqual(new Set(['app_get_runtime_info']));
  });
});

describe('AboutPage — build de desenvolvimento', () => {
  it('marca a versão como de desenvolvimento apenas em build debug', async () => {
    invokeMock.mockResolvedValue({ ...RUNTIME_INFO, buildProfile: 'debug' });
    render(<AboutPage />);

    expect(await screen.findByText(/desenvolvimento/)).toBeInTheDocument();
  });

  it('não marca nada em build de release', async () => {
    render(<AboutPage />);
    await screen.findByText('versão 0.1.0');

    expect(screen.queryByText(/desenvolvimento/)).not.toBeInTheDocument();
  });
});
