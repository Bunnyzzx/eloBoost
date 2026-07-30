import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { TRANSITION_INSTANT } from '@/constants/motion';
import { NAV_ENTRIES, type NavEntry, type NavGroup } from '@/constants/routes';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/utils/cn';

const GROUP_ORDER: readonly NavGroup[] = ['tools', 'records', 'system'];

/** Identifica o destaque compartilhado entre os itens, para o Framer animá-lo. */
const ACTIVE_INDICATOR_ID = 'sidebar-item-ativo';

function NavItem({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;
  const reduceMotion = useReducedMotion();

  return (
    <li>
      <NavLink
        to={entry.path}
        end={entry.path === '/'}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-control py-2 pr-3 pl-3.5',
            'text-sm font-medium',
            'transition-colors duration-(--elo-duration-instant) ease-elo',
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
            <span className="truncate">{entry.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

/**
 * Barra lateral fixa.
 *
 * Largura constante de 224 px — 16 px mais estreita que antes, devolvidos à
 * área de conteúdo. Não recolhe: a navegação é curta o bastante para caber
 * inteira, e um estado a menos significa uma decisão a menos para o usuário e
 * um caminho a menos para testar.
 */
export function Sidebar() {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-subtle bg-surface">
      <div className="flex h-14 items-center border-b border-subtle px-4">
        <Logo />
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2.5 py-3">
        {GROUP_ORDER.map((group, groupIndex) => {
          const entries = NAV_ENTRIES.filter((entry) => entry.group === group);
          if (entries.length === 0) return null;

          return (
            <div key={group} className={cn(groupIndex > 0 && 'mt-3 border-t border-subtle pt-3')}>
              <ul className="space-y-0.5">
                {entries.map((entry) => (
                  <NavItem key={entry.path} entry={entry} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
