import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanupPage } from '@/pages/cleanup/CleanupPage';
import type { CategoryPreview, CleanPreview, CleanReport } from '@/types/cleaner';

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

const SEM_RESSALVAS = {
  accessDenied: 0,
  inUse: 0,
  pathTooLong: 0,
  alreadyGone: 0,
  links: 0,
  rejectedByGuard: 0,
  otherFailures: 0,
};

function previa(overrides: Partial<CategoryPreview> = {}): CategoryPreview {
  return {
    category: 'user_temp',
    name: 'Arquivos temporários',
    description: 'Sobras que programas criam.',
    eligibility: 'selectable',
    note: null,
    fileCount: 40,
    folderCount: 3,
    sizeBytes: 2_097_152,
    skipped: { ...SEM_IGNORADOS },
    ...overrides,
  };
}

const PREVIEW: CleanPreview = {
  previewId: 'prev-1',
  confirmationToken: 'tok-1',
  categories: [
    previa(),
    previa({
      category: 'thumbnails',
      name: 'Miniaturas e ícones',
      sizeBytes: 1_048_576,
      fileCount: 10,
    }),
    previa({
      category: 'downloads',
      name: 'Downloads',
      description: 'Sua pasta de downloads.',
      eligibility: 'read_only_area',
      note: 'Área pessoal: o eloBoost mede o espaço, mas nunca remove nada daqui em lote.',
      sizeBytes: 10_485_760,
      fileCount: 12,
    }),
  ],
  removableBytes: 3_145_728,
  removableFiles: 50,
  selectableCategories: 2,
  durationMs: 60,
  createdAt: '2026-07-31T10:00:00Z',
};

const REPORT: CleanReport = {
  operationId: 'op-1',
  outcome: 'success',
  categories: [
    {
      category: 'user_temp',
      name: 'Arquivos temporários',
      status: 'completed',
      removedFiles: 40,
      removedFolders: 3,
      freedBytes: 2_097_152,
      skipped: { ...SEM_RESSALVAS },
      durationMs: 30,
      message: null,
    },
    {
      category: 'thumbnails',
      name: 'Miniaturas e ícones',
      status: 'completed',
      removedFiles: 10,
      removedFolders: 0,
      freedBytes: 1_048_576,
      skipped: { ...SEM_RESSALVAS },
      durationMs: 5,
      message: null,
    },
    {
      category: 'downloads',
      name: 'Downloads',
      status: 'skipped',
      removedFiles: 0,
      removedFolders: 0,
      freedBytes: 0,
      skipped: { ...SEM_RESSALVAS },
      durationMs: 0,
      message: null,
    },
  ],
  freedBytes: 3_145_728,
  removedFiles: 50,
  removedFolders: 3,
  skipped: { ...SEM_RESSALVAS },
  executedCategories: 2,
  durationMs: 1_200,
  finishedAt: '2026-07-31T10:01:00Z',
};

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
    if (command === 'cleaner_preview') return Promise.resolve(PREVIEW);
    if (command === 'cleaner_execute') return Promise.resolve(REPORT);
    return Promise.reject(new Error(`comando inesperado: ${command}`));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Leva a tela até a fase de seleção. */
async function analisar() {
  const user = userEvent.setup();
  render(<CleanupPage />);
  await user.click(screen.getByRole('button', { name: /analisar computador/i }));
  await screen.findByRole('button', { name: /limpar selecionadas/i });
  return user;
}

describe('CleanupPage — estado inicial', () => {
  it('começa sem analisar nada', () => {
    render(<CleanupPage />);

    expect(screen.getByText('Vamos ver o que dá para liberar')).toBeInTheDocument();
    expect(screen.getByText(/nenhum arquivo é removido durante a análise/i)).toBeInTheDocument();

    const comandos = invokeMock.mock.calls.map((call) => call[0] as string);
    expect(comandos).not.toContain('cleaner_preview');
    expect(comandos).not.toContain('cleaner_execute');
  });
});

describe('CleanupPage — seleção', () => {
  it('marca por padrão apenas as áreas selecionáveis', async () => {
    await analisar();

    const temporarios = screen.getByRole('checkbox', { name: /arquivos temporários/i });
    const miniaturas = screen.getByRole('checkbox', { name: /miniaturas/i });

    expect(temporarios).toHaveAttribute('aria-checked', 'true');
    expect(miniaturas).toHaveAttribute('aria-checked', 'true');
  });

  it('nunca oferece caixa de seleção para a pasta pessoal', async () => {
    await analisar();

    // A trava mais importante da tela: Downloads aparece, mas não é marcável.
    expect(screen.queryByRole('checkbox', { name: /downloads/i })).not.toBeInTheDocument();

    const downloads = screen.getByText('Downloads').closest('div[class*="rounded-card"]');
    expect(within(downloads as HTMLElement).getByText('Nunca limpo em lote')).toBeInTheDocument();
  });

  it('atualiza o total ao desmarcar uma área', async () => {
    const user = await analisar();

    const total = screen.getByRole('status', { name: /selecionado para remover/i });
    expect(within(total).getByText('3,0 MB')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /miniaturas/i }));

    // 3 MB menos o 1 MB das miniaturas.
    expect(within(total).getByText('2,0 MB')).toBeInTheDocument();
  });

  it('desabilita o botão quando nada está marcado', async () => {
    const user = await analisar();

    await user.click(screen.getByRole('checkbox', { name: /marcar todas/i }));

    expect(screen.getByRole('button', { name: /limpar selecionadas/i })).toBeDisabled();
  });
});

describe('CleanupPage — confirmação', () => {
  it('não limpa nada sem passar pela confirmação', async () => {
    const user = await analisar();

    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));

    // O modal abriu, mas a execução ainda não foi disparada.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(invokeMock.mock.calls.map((call) => call[0] as string)).not.toContain('cleaner_execute');
  });

  it('mostra o total, as áreas e a promessa sobre arquivos pessoais', async () => {
    const user = await analisar();
    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));

    const dialogo = await screen.findByRole('dialog');

    expect(within(dialogo).getByText('3,0 MB')).toBeInTheDocument();
    expect(within(dialogo).getByText(/50 arquivos/)).toBeInTheDocument();
    expect(within(dialogo).getByText('Arquivos temporários')).toBeInTheDocument();
    expect(within(dialogo).getByText('Nenhum arquivo pessoal será removido.')).toBeInTheDocument();
    expect(within(dialogo).getByText(/não pode ser desfeita/i)).toBeInTheDocument();
  });

  it('cancelar fecha o diálogo sem executar', async () => {
    const user = await analisar();
    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));

    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(invokeMock.mock.calls.map((call) => call[0] as string)).not.toContain('cleaner_execute');
  });

  it('envia o par prévia + token que o backend exige', async () => {
    const user = await analisar();
    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));

    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /limpar agora/i }));

    await screen.findByText('Limpeza concluída');

    const chamada = invokeMock.mock.calls.find((call) => call[0] === 'cleaner_execute');
    expect(chamada?.[1]).toMatchObject({
      previewId: 'prev-1',
      confirmationToken: 'tok-1',
    });
    // Downloads jamais entra na carga enviada ao backend.
    expect(chamada?.[1]).toHaveProperty('categories');
    expect((chamada?.[1] as { categories: string[] }).categories).not.toContain('downloads');
  });
});

describe('CleanupPage — execução e resultado', () => {
  async function limpar() {
    const user = await analisar();
    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /limpar agora/i }));
    return user;
  }

  it('mostra o resultado com espaço liberado, arquivos e tempo', async () => {
    await limpar();

    const titulo = await screen.findByText('Limpeza concluída');
    const resumo = titulo.closest('div[class*="rounded-card"]') as HTMLElement;

    expect(within(resumo).getByText('3,0 MB')).toBeInTheDocument();
    expect(within(resumo).getByText('50')).toBeInTheDocument();
    expect(within(resumo).getByText('1,2 s')).toBeInTheDocument();
  });

  it('afirma que apenas as áreas marcadas foram limpas', async () => {
    await limpar();
    await screen.findByText('Limpeza concluída');

    expect(screen.getByText(/somente as áreas marcadas foram limpas/i)).toBeInTheDocument();
  });

  it('atualiza um card ao vivo quando o progresso chega', async () => {
    const user = await analisar();

    // Segura a execução para que os eventos cheguem antes do relatório.
    let concluir: (report: CleanReport) => void = () => undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command === 'cleaner_preview') return Promise.resolve(PREVIEW);
      if (command === 'cleaner_execute') {
        return new Promise<CleanReport>((resolve) => {
          concluir = resolve;
        });
      }
      return Promise.reject(new Error(`comando inesperado: ${command}`));
    });

    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /limpar agora/i }));

    await waitFor(() => expect(ouvintes.length).toBeGreaterThan(0));
    for (const ouvinte of ouvintes) {
      ouvinte({
        payload: { category: 'user_temp', removedFiles: 25, freedBytes: 1_048_576 },
      });
    }

    const card = (await screen.findByText('Arquivos temporários')).closest(
      'div[class*="rounded-card"]',
    );
    expect(within(card as HTMLElement).getByText(/25 arquivos até agora/)).toBeInTheDocument();

    concluir(REPORT);
    expect(await screen.findByText('Limpeza concluída')).toBeInTheDocument();
  });

  it('mostra o que ficou para trás quando a limpeza é parcial', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'cleaner_preview') return Promise.resolve(PREVIEW);
      if (command === 'cleaner_execute') {
        return Promise.resolve({
          ...REPORT,
          outcome: 'partial',
          skipped: { ...SEM_RESSALVAS, inUse: 4, accessDenied: 1 },
        });
      }
      return Promise.reject(new Error(`comando inesperado: ${command}`));
    });

    await limpar();

    expect(await screen.findByText('Limpeza concluída em parte')).toBeInTheDocument();
    expect(screen.getByText(/4 arquivos em uso por outros programas/i)).toBeInTheDocument();
    expect(screen.getByText(/1 arquivo sem permissão/i)).toBeInTheDocument();
  });
});

describe('CleanupPage — falha', () => {
  it('exibe a recusa do backend quando a confirmação não vale', async () => {
    const user = await analisar();

    invokeMock.mockImplementation((command: string) => {
      if (command === 'cleaner_preview') return Promise.resolve(PREVIEW);
      return Promise.reject({
        code: 'CONFIRMATION_EXPIRED',
        message: 'A confirmação expirou. Analise novamente para atualizar os resultados.',
        technicalDetails: null,
        suggestion: 'Analise novamente para atualizar os resultados.',
        retryable: true,
        diagnosticId: 'elo-teste',
      });
    });

    await user.click(screen.getByRole('button', { name: /limpar selecionadas/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /limpar agora/i }));

    expect(await screen.findByText(/a confirmação expirou/i)).toBeInTheDocument();
    expect(screen.queryByText('Limpeza concluída')).not.toBeInTheDocument();
  });
});
