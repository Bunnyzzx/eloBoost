import { AlertTriangle, Circle, CircleAlert, Info, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RiskLevel } from '@/types/app';
import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'attention' | 'critical';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-elevated text-fg-secondary border-subtle',
  accent: 'bg-accent-soft text-accent border-accent/30',
  ok: 'bg-ok-soft text-ok border-ok/30',
  attention: 'bg-attention-soft text-attention border-attention/30',
  critical: 'bg-critical-soft text-critical border-critical/30',
};

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[0.75rem] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon != null && (
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

const RISK_CONFIG: Record<RiskLevel, { tone: BadgeTone; label: string; icon: ReactNode }> = {
  low: { tone: 'ok', label: 'Baixo risco', icon: <ShieldCheck className="size-3.5" /> },
  medium: { tone: 'attention', label: 'Médio risco', icon: <CircleAlert className="size-3.5" /> },
  high: { tone: 'critical', label: 'Alto risco', icon: <AlertTriangle className="size-3.5" /> },
};

export interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

/**
 * Indicador de risco.
 *
 * Acessibilidade (docs/08 §6): o risco NUNCA é comunicado apenas por cor —
 * o rótulo textual e o ícone acompanham sempre.
 */
export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = RISK_CONFIG[level];
  return (
    <Badge tone={config.tone} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  );
}

export interface InfoBadgeProps {
  children: ReactNode;
  className?: string;
}

export function InfoBadge({ children, className }: InfoBadgeProps) {
  return (
    <Badge tone="neutral" icon={<Info className="size-3.5" />} className={className}>
      {children}
    </Badge>
  );
}

export function StatusDot({ tone = 'neutral' }: { tone?: BadgeTone }) {
  const color: Record<BadgeTone, string> = {
    neutral: 'text-fg-muted',
    accent: 'text-accent',
    ok: 'text-ok',
    attention: 'text-attention',
    critical: 'text-critical',
  };
  return <Circle aria-hidden className={cn('size-2 fill-current', color[tone])} />;
}
