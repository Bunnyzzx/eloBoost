import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { NAV_ENTRIES, type NavEntry, type NavGroup } from '@/constants/routes';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const GROUP_ORDER: readonly NavGroup[] = ['tools', 'records', 'system'];

function NavItem({ entry, collapsed }: { entry: NavEntry; collapsed: boolean }) {
  const Icon = entry.icon;

  const link = (
    <NavLink
      to={entry.path}
      end={entry.path === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-control px-3 py-2',
          'text-sm font-medium transition-colors duration-150 ease-elo',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-soft text-fg'
            : 'text-fg-secondary hover:bg-accent-soft/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicador de rota ativa: não depende apenas de cor. */}
          <span
            aria-hidden
            className={cn(
              'absolute left-0 h-5 w-0.5 rounded-r-full bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="truncate">{entry.label}</span>}
        </>
      )}
    </NavLink>
  );

  return collapsed ? (
    <li>
      <Tooltip content={entry.label} side="right">
        {link}
      </Tooltip>
    </li>
  ) : (
    <li>{link}</li>
  );
}

/**
 * Barra lateral fixa.
 *
 * Recolhe para 64 px por ação do usuário ou automaticamente em janelas
 * estreitas (tratado em AppLayout).
 */
export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-subtle bg-surface',
        'transition-[width] duration-200 ease-elo',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-subtle',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}
      >
        <Logo compact={collapsed} />
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2.5 py-3">
        {GROUP_ORDER.map((group, groupIndex) => {
          const entries = NAV_ENTRIES.filter((entry) => entry.group === group);
          if (entries.length === 0) return null;

          return (
            <div key={group} className={cn(groupIndex > 0 && 'mt-3 border-t border-subtle pt-3')}>
              <ul className="space-y-0.5">
                {entries.map((entry) => (
                  <NavItem key={entry.path} entry={entry} collapsed={collapsed} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-subtle p-2.5">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          className={cn(
            'flex w-full items-center gap-3 rounded-control px-3 py-2',
            'text-[0.8125rem] text-fg-muted transition-colors duration-150',
            'hover:bg-accent-soft/60 hover:text-fg',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-[18px]" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose aria-hidden className="size-[18px]" strokeWidth={1.75} />
          )}
          {!collapsed && <span>Recolher</span>}
          <span className="sr-only">
            {collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          </span>
        </button>
      </div>
    </aside>
  );
}
