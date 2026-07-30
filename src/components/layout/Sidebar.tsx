import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { TRANSITION_INSTANT } from '@/constants/motion';
import { NAV_ENTRIES, type NavEntry, type NavGroup } from '@/constants/routes';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const GROUP_ORDER: readonly NavGroup[] = ['tools', 'records', 'system'];

/** Identifica o destaque compartilhado entre os itens, para o Framer animá-lo. */
const ACTIVE_INDICATOR_ID = 'sidebar-item-ativo';

function NavItem({ entry, collapsed }: { entry: NavEntry; collapsed: boolean }) {
  const Icon = entry.icon;
  const reduceMotion = useReducedMotion();

  const link = (
    <NavLink
      to={entry.path}
      end={entry.path === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-control px-3 py-2',
          'text-sm font-medium',
          'transition-colors duration-(--elo-duration-instant) ease-elo',
          collapsed && 'justify-center px-0',
          isActive ? 'text-fg' : 'text-fg-secondary hover:bg-accent-soft/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/*
            Destaque do item ativo.

            `layoutId` faz o Framer deslizar o mesmo elemento entre itens em vez
            de sumir num e aparecer noutro. Fica atrás do conteúdo (`-z-10`) e é
            posicionado em absoluto, então não participa do layout — trocar de
            rota não desloca nada.

            Com movimento reduzido, o destaque continua existindo, apenas aparece
            instantaneamente no lugar certo.
          */}
          {isActive && (
            <motion.span
              aria-hidden
              layoutId={reduceMotion ? undefined : ACTIVE_INDICATOR_ID}
              transition={TRANSITION_INSTANT}
              className="absolute inset-0 -z-10 rounded-control bg-accent-soft"
            />
          )}

          {/* Barra à esquerda: o segundo sinal do item ativo, além do fundo. */}
          <span
            aria-hidden
            className={cn(
              'absolute left-0 h-5 w-0.5 rounded-r-full bg-accent',
              'transition-opacity duration-(--elo-duration-instant)',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />

          <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />

          {/*
            O rótulo sai de cena por opacidade, não por desmontagem: manter o
            nó no DOM evita que a largura do texto seja recalculada no meio da
            transição da barra, que é o que produz o "pulo" clássico.
          */}
          <span
            className={cn(
              'truncate transition-[opacity,max-width] duration-(--elo-duration-base) ease-elo',
              collapsed ? 'pointer-events-none max-w-0 opacity-0' : 'max-w-40 opacity-100',
            )}
          >
            {entry.label}
          </span>
        </>
      )}
    </NavLink>
  );

  // Recolhida, o rótulo só existe no tooltip — que responde a hover e a foco.
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
 * estreitas (tratado em `AppLayout`). A largura é animada por transição CSS —
 * um único valor interpolado, sem JavaScript por frame.
 */
export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-subtle bg-surface',
        'transition-[width] duration-(--elo-duration-slow) ease-elo',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center overflow-hidden border-b border-subtle',
          'transition-[padding] duration-(--elo-duration-slow) ease-elo',
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
            'flex w-full items-center gap-3 overflow-hidden rounded-control px-3 py-2',
            'text-[0.8125rem] text-fg-muted',
            'transition-colors duration-(--elo-duration-instant) ease-elo',
            'hover:bg-accent-soft/60 hover:text-fg',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          )}
          <span
            className={cn(
              'truncate transition-[opacity,max-width] duration-(--elo-duration-base) ease-elo',
              collapsed ? 'pointer-events-none max-w-0 opacity-0' : 'max-w-40 opacity-100',
            )}
          >
            Recolher
          </span>
          <span className="sr-only">
            {collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          </span>
        </button>
      </div>
    </aside>
  );
}
