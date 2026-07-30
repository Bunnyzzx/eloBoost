import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScannerPage } from '@/pages/scanner/ScannerPage';
import type { CategoryScan, ScanSummary } from '@/types/scanner';

const invokeMock = vi.hoisted(() => vi.fn());
const listenMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

const SEM_IGNORADOS = {
  accessDenied: 0,
  pathTooLong: 0,
  inUse: 0,
  links: 0,
  depthExceeded: 0,
  readErrors: 0,
};

function categoria(overrides: Partial<CategoryScan> = {}): CategoryScan {
  return {
    category: 'user_temp',
    name: 'Arquivos temporários',
    description: 'Sobras que programas criam enquanto funcionam.',
    removalPolicy: 'cleanable',
    fileCount: 0,
    folderCount: 0,
    sizeBytes: 0,
    durationMs: 0,
    status: 'not_found',
    message: 'Ainda não analisada.',
    skipped: { ...SEM_IGNORADOS },
    ...overrides,
  };
}

const CATEGORIAS_INICIAIS: CategoryScan[] = [
  categoria(),
  categoria({ category: 'recycle_bin', name: 'Lixeira' }),
  categoria({
    category: 'downloads',
    name: 'Downloads',
    description: 'Sua pasta de downloads. O eloBoost apenas mede o tamanho.',
    removalPolicy: 'manual_selection_only',
  }),
];

const RESUMO: ScanSummary = {
  scanId: 'scan-teste',
  categories: [
    categoria({ status: 'completed', fileCount: 120, folderCount: 8, sizeBytes: 2_097_152 }),
    categoria({
      category: 'recycle_bin',
      name: 'Lixeira',
      status: 'completed',
      fileCount: 4,
      sizeBytes: 1_048_576,
      message: null,
    }),
    categoria({
      category: 'downloads',
      name: 'Downloads',
      description: 'Sua pasta de downloads. O eloBoost apenas mede o tamanho.',
      removalPolicy: 'manual_selection_only',
      status: 'completed',
      fileCount: 10,
      sizeBytes: 10_485_760,
      message: null,
    }),
  ],
  reclaimableBytes: 3_145_728,
  measuredBytes: 13_631_488,
  totalFiles: 134,
  totalFolders: 8,
  durationMs: 1_430,
  measuredCategories: 3,
  finishedAt: '2026-07-30T17:00:00Z',
};

/** Handlers registrados via `listen`, para simular eventos do backend. */
let ouvintes: Array<(evento: { payload: unknown }) => void> = [];

beforeEach(() => {
  invokeMock.mockReset();
  listenMock.mockReset();
  ouvintes = [];

  (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};

  listenMock.mockImplementation((_evento: string, handler: (e: { payload: unknown }) => void) => {
    ouvintes.push(handler);
    return Promise.resolve(() => undefined);
  });

  invokeMock.mockImplementation((command: string) => {
    if (command === 'scanner_list_categories') return Promise.resolve(CATEGORIAS_INICIAIS);
    if (command === 'scanner_scan_all') return Promise.resolve(RESUMO);
    return Promise.reject(new Error(`comando inesperado: ${command}`));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ScannerPage — estado inicial', () => {
  it('começa vazia, explicando o que a análise faz', async () => {
    render(<ScannerPage />);

    expect(await screen.findByText('Nenhuma análise feita ainda')).toBeInTheDocument();
    expect(screen.getByText(/nenhum arquivo é aberto, alterado ou removido/i)).toBeInTheDocument();
  });

  it('não analisa nada até o usuário pedir', async () => {
    render(<ScannerPage />);
    await screen.findByText('Nenhuma análise feita ainda');

    const comandos = invokeMock.mock.calls.map((call) => call[0] as string);
    expect(comandos).not.toContain('scanner_scan_all');
  });
});

describe('ScannerPage — análise em andamento', () => {
  it('mostra cada área assim que ela termina, sem esperar as demais', async () => {
    const user = userEvent.setup();

    // Segura o comando: o resumo só chega depois dos eventos de progresso.
    let concluir: (resumo: ScanSummary) => void = () => undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command === 'scanner_list_categories') return Promise.resolve(CATEGORIAS_INICIAIS);
      if (command === 'scanner_scan_all') {
        return new Promise<ScanSummary>((resolve) => {
          concluir = resolve;
        });
      }
      return Promise.reject(new Error(`comando inesperado: ${command}`));
    });

    render(<ScannerPage />);
    await screen.findByText('Nenhuma análise feita ainda');
    await user.click(screen.getByRole('button', { name: /analisar computador/i }));

    // A Lixeira responde primeiro.
    await waitFor(() => expect(ouvintes.length).toBeGreaterThan(0));
    for (const ouvinte of ouvintes) {
      ouvinte({
        payload: categoria({
          category: 'recycle_bin',
          name: 'Lixeira',
          status: 'completed',
          fileCount: 4,
          sizeBytes: 1_048_576,
          message: null,
        }),
      });
    }

    // O card da Lixeira já traz números; os outros continuam analisando.
    const lixeira = (await screen.findByText('Lixeira')).closest('div[class*="rounded-card"]');
    expect(lixeira).not.toBeNull();
    expect(within(lixeira as HTMLElement).getByText('1,0 MB')).toBeInTheDocument();

    expect(screen.getAllByText('Analisando').length).toBeGreaterThan(0);
    expect(screen.getByText('1 de 3 áreas')).toBeInTheDocument();

    concluir(RESUMO);
    expect(await screen.findByText('Espaço recuperável')).toBeInTheDocument();
  });

  it('usa progresso indeterminado enquanto nenhuma área respondeu', async () => {
    const user = userEvent.setup();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'scanner_list_categories') return Promise.resolve(CATEGORIAS_INICIAIS);
      return new Promise<never>(() => undefined);
    });

    render(<ScannerPage />);
    await screen.findByText('Nenhuma análise feita ainda');
    await user.click(screen.getByRole('button', { name: /analisar computador/i }));

    const barra = await screen.findByRole('progressbar', { name: 'Progresso da análise' });
    // Sem valor conhecido, a barra não afirma um percentual.
    expect(barra).toHaveAttribute('aria-valuetext', 'Em andamento');
    expect(barra).not.toHaveAttribute('aria-valuenow');
  });
});

describe('ScannerPage — análise concluída', () => {
  async function analisar() {
    const user = userEvent.setup();
    render(<ScannerPage />);
    await screen.findByText('Nenhuma análise feita ainda');
    await user.click(screen.getByRole('button', { name: /analisar computador/i }));
    await screen.findByText('Espaço recuperável');
    return user;
  }

  it('afirma claramente que nada foi removido', async () => {
    await analisar();

    // O requisito de transparência do Épico 2.
    expect(screen.getByText('Nenhum arquivo foi removido.')).toBeInTheDocument();
    expect(screen.getByText(/apenas uma análise/i)).toBeInTheDocument();
  });

  it('mostra os totais da análise', async () => {
    await analisar();

    expect(screen.getByText('3,0 MB')).toBeInTheDocument(); // espaço recuperável
    expect(screen.getByText('134')).toBeInTheDocument(); // arquivos
    expect(screen.getByText('1,4 s')).toBeInTheDocument(); // duração
  });

  it('não inclui a pasta pessoal no espaço recuperável', async () => {
    await analisar();

    // 13 MB medidos, 3 MB recuperáveis: os 10 MB de Downloads aparecem como
    // ressalva, nunca somados na promessa de espaço.
    expect(screen.getByText(/10,0 MB a mais em pastas suas/)).toBeInTheDocument();
  });

  it('marca a pasta pessoal como somente medida', async () => {
    await analisar();

    const downloads = screen.getByText('Downloads').closest('div[class*="rounded-card"]');
    expect(downloads).not.toBeNull();
    expect(within(downloads as HTMLElement).getByText('Nunca limpo em lote')).toBeInTheDocument();
  });

  it('permite analisar novamente', async () => {
    await analisar();
    expect(screen.getByRole('button', { name: /analisar novamente/i })).toBeInTheDocument();
  });
});

describe('ScannerPage — falha', () => {
  it('exibe o erro e oferece nova tentativa, sem cards pela metade', async () => {
    const user = userEvent.setup();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'scanner_list_categories') return Promise.resolve(CATEGORIAS_INICIAIS);
      return Promise.reject({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Outra operação está em andamento.',
        technicalDetails: null,
        suggestion: 'Aguarde a conclusão e tente novamente.',
        retryable: true,
        diagnosticId: 'elo-teste',
      });
    });

    render(<ScannerPage />);
    await screen.findByText('Nenhuma análise feita ainda');
    await user.click(screen.getByRole('button', { name: /analisar computador/i }));

    expect(await screen.findByText('Outra operação está em andamento.')).toBeInTheDocument();
    expect(screen.queryByText('Espaço recuperável')).not.toBeInTheDocument();
  });
});
