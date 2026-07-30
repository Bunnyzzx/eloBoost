import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AboutPage } from '@/pages/about/AboutPage';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

function setTauriPresent(present: boolean) {
  if (present) {
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
  } else {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
  }
}

const APP_INFO = {
  name: 'eloBoost',
  version: '0.1.0',
  buildProfile: 'debug',
  runningInTauri: true,
};

const DATABASE_STATUS = {
  schemaVersion: 1,
  expectedVersion: 1,
  appliedMigrations: [{ version: 1, name: 'init', appliedAt: '2026-07-29T12:00:00Z' }],
  databasePathMasked: 'C:\\Users\\%USER%\\%APPDATA%\\eloBoost\\eloboost.db',
  sizeBytes: 131072,
  healthy: true,
};

beforeEach(() => {
  invokeMock.mockReset();
  setTauriPresent(true);
});

describe('AboutPage — caminho completo até o backend', () => {
  it('exibe versão e diagnóstico do banco vindos dos comandos Tauri', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'app_get_info') return Promise.resolve(APP_INFO);
      if (command === 'app_get_database_status') return Promise.resolve(DATABASE_STATUS);
      return Promise.reject(new Error(`comando inesperado: ${command}`));
    });

    render(<AboutPage />);

    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
    expect(await screen.findByText('1 de 1')).toBeInTheDocument();
    expect(screen.getByText('128 KB')).toBeInTheDocument();
    expect(screen.getByText('Íntegro')).toBeInTheDocument();
    expect(screen.getByText(/init/)).toBeInTheDocument();
  });

  it('mostra o caminho do banco já mascarado, sem o nome real da conta', async () => {
    invokeMock.mockImplementation((command: string) =>
      command === 'app_get_info' ? Promise.resolve(APP_INFO) : Promise.resolve(DATABASE_STATUS),
    );

    render(<AboutPage />);

    expect(await screen.findByText(/%USER%/)).toBeInTheDocument();
  });

  it('apresenta erro do backend com sugestão e ID de diagnóstico, sem stack trace', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'app_get_info') return Promise.resolve(APP_INFO);
      return Promise.reject({
        code: 'DATABASE_ERROR',
        message: 'Não foi possível acessar os dados locais do eloBoost.',
        technicalDetails: 'rusqlite::Error: database is locked',
        suggestion: 'Reinicie o eloBoost. Se persistir, informe o ID de diagnóstico.',
        retryable: true,
        diagnosticId: 'elo-abc123',
      });
    });

    render(<AboutPage />);

    expect(
      await screen.findByText('Não foi possível acessar os dados locais do eloBoost.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/elo-abc123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });

  it('permite tentar novamente após uma falha', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'app_get_info') return Promise.resolve(APP_INFO);
      return Promise.reject({
        code: 'DATABASE_ERROR',
        message: 'Não foi possível acessar os dados locais do eloBoost.',
        technicalDetails: null,
        suggestion: null,
        retryable: true,
        diagnosticId: 'elo-1',
      });
    });

    render(<AboutPage />);
    await screen.findByRole('button', { name: /Tentar novamente/ });

    const chamadasAntes = invokeMock.mock.calls.filter(
      (call) => call[0] === 'app_get_database_status',
    ).length;

    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));

    await waitFor(() => {
      const chamadasDepois = invokeMock.mock.calls.filter(
        (call) => call[0] === 'app_get_database_status',
      ).length;
      expect(chamadasDepois).toBeGreaterThan(chamadasAntes);
    });
  });

  it('rejeita resposta fora do contrato em vez de exibir dado inválido', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'app_get_info') return Promise.resolve(APP_INFO);
      // `schemaVersion` como texto: divergência de contrato.
      return Promise.resolve({ ...DATABASE_STATUS, schemaVersion: 'um' });
    });

    render(<AboutPage />);

    expect(
      await screen.findByText('A resposta recebida do aplicativo não pôde ser interpretada.'),
    ).toBeInTheDocument();
  });

  it('fora do Tauri, informa que o banco local não existe em vez de falhar', async () => {
    setTauriPresent(false);
    render(<AboutPage />);

    expect(
      await screen.findByText(/O banco local só existe no aplicativo instalado/),
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('lista os compromissos do produto', () => {
    setTauriPresent(false);
    render(<AboutPage />);

    expect(
      screen.getByText('Desativar o Windows Defender, o firewall ou o Windows Update'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Executar comandos arbitrários vindos da interface'),
    ).toBeInTheDocument();
  });
});
