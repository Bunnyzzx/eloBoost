import { AlertTriangle, CheckCircle2, CircleHelp, Info, ShieldCheck, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { StatusTone } from '@/utils/status';

export interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  /** Explicação exibida em tooltip — o que este estado significa. */
  hint?: string;
  /** Usa o ícone de escudo, para indicadores de privilégio e segurança. */
  shield?: boolean;
  className?: string;
}

const TONE_MAP: Record<StatusTone, { badge: BadgeTone; icon: ReactNode }> = {
  ok: { badge: 'ok', icon: <CheckCircle2 className="size-3.5" /> },
  attention: { badge: 'attention', icon: <AlertTriangle className="size-3.5" /> },
  critical: { badge: 'critical', icon: <XCircle className="size-3.5" /> },
  info: { badge: 'accent', icon: <Info className="size-3.5" /> },
  unknown: { badge: 'neutral', icon: <CircleHelp className="size-3.5" /> },
};

/**
 * Indicador de estado reutilizável.
 *
 * Acessibilidade (docs/08 §6): o estado **nunca** é comunicado apenas por cor —
 * cada tom tem ícone próprio e o rótulo textual acompanha sempre.
 */
export function StatusBadge({ tone, children, hint, shield = false, className }: StatusBadgeProps) {
  const config = TONE_MAP[tone];
  const icon = shield ? <ShieldCheck className="size-3.5" /> : config.icon;

  const badge = (
    <Badge tone={config.badge} icon={icon} className={className}>
      {children}
    </Badge>
  );

  return hint != null ? (
    <Tooltip content={hint} side="bottom">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}
