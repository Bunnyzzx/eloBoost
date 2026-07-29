import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '@/layouts/AppLayout';
import { AboutPage } from '@/pages/about/AboutPage';
import { InstalledAppsPage } from '@/pages/apps/InstalledAppsPage';
import { CleanupPage } from '@/pages/cleanup/CleanupPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { MonitoringPage } from '@/pages/monitoring/MonitoringPage';
import { OptimizationsPage } from '@/pages/optimizations/OptimizationsPage';
import { ProcessesPage } from '@/pages/processes/ProcessesPage';
import { RestorePage } from '@/pages/restore/RestorePage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StartupPage } from '@/pages/startup/StartupPage';
import { StoragePage } from '@/pages/storage/StoragePage';
import { ROUTES } from '@/constants/routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: ROUTES.cleanup.slice(1), element: <CleanupPage /> },
      { path: ROUTES.optimizations.slice(1), element: <OptimizationsPage /> },
      { path: ROUTES.startup.slice(1), element: <StartupPage /> },
      { path: ROUTES.apps.slice(1), element: <InstalledAppsPage /> },
      { path: ROUTES.processes.slice(1), element: <ProcessesPage /> },
      { path: ROUTES.storage.slice(1), element: <StoragePage /> },
      { path: ROUTES.monitoring.slice(1), element: <MonitoringPage /> },
      { path: ROUTES.restore.slice(1), element: <RestorePage /> },
      { path: ROUTES.history.slice(1), element: <HistoryPage /> },
      { path: ROUTES.settings.slice(1), element: <SettingsPage /> },
      { path: ROUTES.about.slice(1), element: <AboutPage /> },
      // Rota desconhecida volta ao início em vez de exibir tela em branco.
      { path: '*', element: <Navigate to={ROUTES.dashboard} replace /> },
    ],
  },
]);
