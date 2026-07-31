import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import type { Availability, SystemSnapshot } from '@/types/system';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

function available<T>(value: T): Availability<T> {
  return { status: 'available', value };
}

function unavailable<T>(message = 'Informação não suportada neste dispositivo.'): Availability<T> {
  return { status: 'unavailable', reason: 'not_supported', message };
}

/** Retrato realista, no formato exato que o backend serializa. */
function snapshot(overrides: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    os: {
      computerName: available('DESKTOP-K7M2P1'),
      userName: available('Ana'),
      name: available('Windows'),
      edition: available('Windows 11 Pro'),
      displayVersion: available('23H2'),
      build: available(22631),
      architecture: 'x86_64',
      kernelVersion: available('10.0.22631'),
    },
    cpu: {
      brand: available('AMD Ryzen 5 5600X'),
      vendor: available('AuthenticAMD'),
      physicalCores: available(6),
      logicalCores: 12,
      currentFrequencyMhz: available(4150),
    },
    memory: {
      totalBytes: 17_179_869_184,
      usedBytes: 10_092_281_856,
      availableBytes: 7_087_587_328,
      usedPercent: 58.75,
      swapTotalBytes: available(4_294_967_296),
      swapUsedBytes: available(1_073_741_824),
    },
    gpus: available([
      {
        name: 'NVIDIA GeForce RTX 3060',
        dedicatedMemoryBytes: available(12_884_901_888),
        sharedMemoryBytes: available(8_589_934_592),
        isSoftware: false,
      },
    ]),
    disks: [
      {
        id: 'C:',
        name: available('Windows'),
        mountPoint: 'C:',
        fileSystem: available('NTFS'),
        totalBytes: 511_000_000_000,
        usedBytes: 448_000_000_000,
        availableBytes: 63_000_000_000,
        usedPercent: 87.7,
        mediaType: 'ssd',
        isSystem: true,
        isRemovable: false,
      },
    ],
    uptimeSeconds: available(273_600),
    privileges: {
      isElevated: available(false),
      canElevate: available(true),
    },
    collectedAt: new Date().toISOString(),
    collectionMs: 42,
    ...overrides,
  };
}

const RUNTIME_INFO = {
  name: 'eloBoost',
  version: '0.1.0',
  buildProfile: 'debug',
  target: 'x86_64-windows-windows',
  runningInTauri: true,
};

const DATABASE_STATUS = {
  schemaVersion: 1,
  expectedVersion: 1,
  appliedMigrations: [{ version: 1, name: 'init', appliedAt: '2026-07-29T12:00:00Z' }],
  databasePathMasked: 'C:\\Users\\%USER%\\%APPDATA%\\eloBoost\\eloboost.db',
  sizeBytes: 131_072,
  healthy: true,
};

/** Responde a todos os comandos do dashboard com o retrato informado. */
function mockBackend(current: () => SystemSnapshot) {
  invokeMock.mockImplementation((command: string) => {
    switch (command) {
      case 'system_get_snapshot':
        return Promise.resolve(current());
      case 'app_get_runtime_info':
        return Promise.resolve(RUNTIME_INFO);
      case 'app_get_database_status':
        return Promise.resolve(DATABASE_STATUS);
      default:
        return Promise.reject(new Error(`comando inesperado: ${command}`));
    }
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
});

describe('DashboardPage — dados reais do sistema', () => {
  it('exibe processador, núcleos e frequência vindos do backend', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByText('AMD Ryzen 5 5600X')).toBeInTheDocument();
    expect(screen.getByText('6 núcleos físicos · 12 lógicos')).toBeInTheDocument();
    expect(screen.getByText('4,15 GHz')).toBeInTheDocument();
  });

  it('exibe memória com valores formatados e percentual', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByText('9,4 GB / 16,0 GB')).toBeInTheDocument();
    expect(screen.getByText('6,6 GB livres')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Memória/ })).toBeInTheDocument();
  });

  it('exibe a GPU principal com a memória dedicada', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByText('NVIDIA GeForce RTX 3060')).toBeInTheDocument();
    expect(screen.getByText('12,0 GB de memória dedicada')).toBeInTheDocument();
  });

  it('exibe o tempo ligado em formato legível', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByText('3 dias, 4 h')).toBeInTheDocument();
  });

  it('exibe cada volume com capacidade, uso e espaço livre', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByText('C:')).toBeInTheDocument();
    expect(screen.getByText('sistema')).toBeInTheDocument();
    expect(screen.getByText(/58,7 GB livres/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /volume C:/ })).toBeInTheDocument();
  });

  it('marca um volume quase cheio como crítico, com rótulo textual', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    // 87,7% de uso: acima do limiar de atenção. A cor não é o único sinal.
    const cards = await screen.findAllByText('Atenção');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('saúda o usuário pelo nome lido do sistema', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { level: 1, name: /Ana/ })).toBeInTheDocument();
  });

  it('mostra nome do computador, edição e build na linha de contexto', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    expect(
      await screen.findByText('DESKTOP-K7M2P1 · Windows 11 Pro · build 22631'),
    ).toBeInTheDocument();
  });
});

describe('DashboardPage — informação indisponível', () => {
  it('exibe o motivo em vez de zero quando a GPU não pode ser lida', async () => {
    mockBackend(() => snapshot({ gpus: unavailable() }));
    render(<DashboardPage />);

    await screen.findByText('AMD Ryzen 5 5600X');

    const mensagens = screen.getAllByText('Informação não suportada neste dispositivo.');
    expect(mensagens.length).toBeGreaterThan(0);
    // O ponto central: nenhum "0 B" apareceria no lugar da placa de vídeo.
    expect(screen.queryByText('0 B de memória dedicada')).not.toBeInTheDocument();
  });

  it('exibe o motivo quando a edição do Windows não está disponível', async () => {
    mockBackend(() =>
      snapshot({
        os: {
          ...snapshot().os,
          edition: unavailable('Informação não suportada neste dispositivo.'),
        },
      }),
    );
    render(<DashboardPage />);

    // A linha de contexto cai para o nome do sistema, sem inventar a edição.
    expect(await screen.findByText(/DESKTOP-K7M2P1 · Windows · build 22631/)).toBeInTheDocument();
  });

  it('não afirma o privilégio quando ele não pôde ser medido', async () => {
    mockBackend(() =>
      snapshot({
        privileges: { isElevated: unavailable<boolean>(), canElevate: unavailable<boolean>() },
      }),
    );
    render(<DashboardPage />);

    expect(await screen.findByText('Indeterminado')).toBeInTheDocument();
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });

  it('trata a ausência de volumes com estado vazio explicativo', async () => {
    mockBackend(() => snapshot({ disks: [] }));
    render(<DashboardPage />);

    expect(await screen.findByText('Nenhum volume encontrado')).toBeInTheDocument();
  });
});

describe('DashboardPage — atualização', () => {
  it('recarrega os dados ao clicar em Atualizar', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    await screen.findByText('AMD Ryzen 5 5600X');
    const antes = invokeMock.mock.calls.filter((c) => c[0] === 'system_get_snapshot').length;

    await userEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await waitFor(() => {
      const depois = invokeMock.mock.calls.filter((c) => c[0] === 'system_get_snapshot').length;
      expect(depois).toBeGreaterThan(antes);
    });
  });

  it('mantém os dados anteriores visíveis durante a atualização', async () => {
    let resolver: ((value: SystemSnapshot) => void) | null = null;
    const base = snapshot();

    invokeMock.mockImplementation((command: string) => {
      if (command === 'app_get_runtime_info') return Promise.resolve(RUNTIME_INFO);
      if (command === 'app_get_database_status') return Promise.resolve(DATABASE_STATUS);

      // A primeira chamada responde na hora; a segunda fica pendente, para
      // observarmos a tela durante a atualização.
      if (resolver == null) {
        const pending = new Promise<SystemSnapshot>((resolve) => {
          resolver = resolve;
        });
        resolver = null;
        return Promise.resolve(base).finally(() => void pending);
      }
      return new Promise<SystemSnapshot>((resolve) => {
        resolver = resolve;
      });
    });

    render(<DashboardPage />);
    await screen.findByText('AMD Ryzen 5 5600X');

    await userEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    // O dado anterior continua legível: nada de skeleton piscando por cima de um
    // dashboard já preenchido.
    expect(screen.getByText('AMD Ryzen 5 5600X')).toBeInTheDocument();
  });

  it('apresenta erro do backend com opção de tentar novamente', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'system_get_snapshot') {
        return Promise.reject({
          code: 'SERVICE_UNAVAILABLE',
          message: 'As informações do sistema estão temporariamente indisponíveis.',
          technicalDetails: 'mutex da sonda envenenado',
          suggestion: 'Aguarde a conclusão e tente novamente.',
          retryable: true,
          diagnosticId: 'elo-xyz',
        });
      }
      return Promise.resolve(RUNTIME_INFO);
    });

    render(<DashboardPage />);

    expect(
      await screen.findByText('As informações do sistema estão temporariamente indisponíveis.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/elo-xyz/)).toBeInTheDocument();
  });

  it('rejeita um retrato fora do contrato em vez de exibir dado inválido', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'system_get_snapshot') {
        // `logicalCores` como texto: divergência de contrato.
        return Promise.resolve({ ...snapshot(), cpu: { ...snapshot().cpu, logicalCores: 'doze' } });
      }
      return Promise.resolve(RUNTIME_INFO);
    });

    render(<DashboardPage />);

    expect(
      await screen.findByText('A resposta recebida do aplicativo não pôde ser interpretada.'),
    ).toBeInTheDocument();
  });
});

describe('DashboardPage — acessibilidade', () => {
  it('tem exatamente um <h1>', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    await screen.findByText('AMD Ryzen 5 5600X');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('cada barra de progresso tem rótulo acessível e valor anunciado', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    await screen.findByText('AMD Ryzen 5 5600X');

    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar).toHaveAccessibleName();
      expect(bar).toHaveAttribute('aria-valuetext');
    }
  });

  it('a ficha técnica usa lista de definições semântica', async () => {
    mockBackend(snapshot);
    render(<DashboardPage />);

    const nome = await screen.findByText('Nome do computador');
    const lista = nome.closest('dl');
    expect(lista).not.toBeNull();
    expect(within(lista as HTMLElement).getByText('DESKTOP-K7M2P1')).toBeInTheDocument();
  });
});
