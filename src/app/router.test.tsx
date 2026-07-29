import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';

import { AppLayout } from '@/layouts/AppLayout';
import { NAV_ENTRIES, ROUTES } from '@/constants/routes';
import { AboutPage } from '@/pages/about/AboutPage';
import { CleanupPage } from '@/pages/cleanup/CleanupPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

/**
 * Monta um subconjunto do roteador real dentro de um MemoryRouter.
 * O objetivo é validar layout + navegação, não reimplementar o router.tsx.
 */
function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path={ROUTES.cleanup.slice(1)} element={<CleanupPage />} />
          <Route path={ROUTES.settings.slice(1)} element={<SettingsPage />} />
          <Route path={ROUTES.about.slice(1)} element={<AboutPage />} />
          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('navegação do aplicativo', () => {
  it('exibe a barra lateral com todas as entradas de navegação', () => {
    renderApp('/');

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    for (const entry of NAV_ENTRIES) {
      expect(within(nav).getByRole('link', { name: entry.label })).toBeInTheDocument();
    }
  });

  it('renderiza o dashboard na rota raiz', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('navega para a limpeza ao clicar no item da barra lateral', async () => {
    renderApp('/');

    await userEvent.click(screen.getByRole('link', { name: 'Limpeza' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Limpeza' })).toBeInTheDocument();
  });

  it('marca a rota ativa com aria-current para leitores de tela', () => {
    renderApp(ROUTES.settings);
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('deixa claro que as telas ainda não implementadas não têm dados', () => {
    renderApp(ROUTES.cleanup);
    expect(screen.getByText('Esta tela ainda não foi implementada')).toBeInTheDocument();
    expect(screen.getByText(/Planejado para: Épico 3/)).toBeInTheDocument();
  });

  it('redireciona rota desconhecida para o início em vez de tela em branco', () => {
    renderApp('/rota-que-nao-existe');
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('exibe a trilha de contexto da rota atual no cabeçalho', () => {
    renderApp(ROUTES.about);

    const breadcrumb = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(breadcrumb).getByText('Sobre')).toBeInTheDocument();
  });

  it('mantém exatamente um <h1> por tela', () => {
    renderApp(ROUTES.cleanup);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

