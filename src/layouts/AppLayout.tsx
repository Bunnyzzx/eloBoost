import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUiStore } from '@/stores/uiStore';

/** Abaixo desta largura a barra lateral recolhe sozinha (docs/08 §2). */
const COLLAPSE_BREAKPOINT_PX = 1100;

export function AppLayout() {
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  // Recolhe automaticamente em janelas estreitas (1280×720 continua confortável).
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COLLAPSE_BREAKPOINT_PX}px)`);
    const apply = (matches: boolean) => {
      if (matches) setSidebarCollapsed(true);
    };

    apply(query.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [setSidebarCollapsed]);

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
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
