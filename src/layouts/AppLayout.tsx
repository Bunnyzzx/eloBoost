import { Outlet, useLocation } from 'react-router-dom';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/motion/PageTransition';

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
        >
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
            {/* Um erro em uma página não derruba a navegação. */}
            <ErrorBoundary area="conteúdo principal">
              {/* A `key` do pathname troca a árvore; só a tela nova é animada. */}
              <PageTransition routeKey={pathname}>
                <Outlet />
              </PageTransition>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
