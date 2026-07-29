import { ChevronRight, Moon, Shield, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { NAV_ENTRIES } from '@/constants/routes';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

/**
 * Indicador de privilégio.
 *
 * No Épico 0 o aplicativo é sempre "Normal" — nenhuma operação elevada existe
 * ainda. Quando o broker elevado entrar (Épico 7), este chip passa a exibir a
 * sessão elevada com contagem regressiva e ação de encerrar.
 */
function PrivilegeChip() {
  return (
    <Tooltip
      content="O eloBoost roda sem privilégios de administrador. A elevação é pedida por operação, quando necessária."
      side="bottom"
    >
      <Badge tone="neutral" icon={<Shield className="size-3.5" />}>
        Normal
      </Badge>
    </Tooltip>
  );
}

function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      className={cn(
        'grid size-8 place-items-center rounded-control text-fg-secondary',
        'transition-colors duration-150 hover:bg-accent-soft hover:text-fg',
      )}
    >
      {isDark ? (
        <Sun aria-hidden className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <Moon aria-hidden className="size-[18px]" strokeWidth={1.75} />
      )}
    </button>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const current = NAV_ENTRIES.find((entry) => entry.path === pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-subtle bg-surface px-6">
      {/* Trilha de contexto — o título da página é o <h1> do próprio conteúdo,
          para que cada tela tenha exatamente um cabeçalho de primeiro nível. */}
      <nav aria-label="Você está em" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-[0.8125rem] text-fg-muted">
          <li>eloBoost</li>
          {current != null && (
            <>
              <li aria-hidden>
                <ChevronRight className="size-3.5" />
              </li>
              <li className="truncate font-medium text-fg-secondary">{current.label}</li>
            </>
          )}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <PrivilegeChip />
        <ThemeToggle />
      </div>
    </header>
  );
}
