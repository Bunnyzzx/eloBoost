import { Clock3, Plug, ShieldCheck, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { StatusBadge } from '@/components/domain/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { isTauriAvailable } from '@/services/ipc';
import { getAppRuntimeInfo, privilegeLabel } from '@/services/systemService';
import type { PrivilegeInfo } from '@/types/system';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';

export interface AppStatusCardProps {
  privileges: PrivilegeInfo | null;
  /** Quando a última leitura do sistema aconteceu. */
  collectedAt: string | null;
}

/** Uma linha do card: ícone, rótulo e valor. */
function StatusLine({
  icon: Icon,
  label,
  children,
  title,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  /** Texto completo em tooltip nativo, quando o valor puder ser truncado. */
  title?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-subtle py-2.5 last:border-0 last:pb-0">
      <span className="flex min-w-0 shrink-0 items-center gap-2.5 text-[0.8125rem] text-fg-secondary">
        <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" strokeWidth={1.75} />
        {label}
      </span>
      {/*
        `min-w-0` no contêiner flexível é o que permite ao filho truncar: sem
        ele, o item nunca encolhe abaixo do conteúdo e o texto vaza do card.
      */}
      <span className="min-w-0 text-right" title={title}>
        {children}
      </span>
    </div>
  );
}

/**
 * Cartão de estado do eloBoost.
 *
 * Mostra **apenas o que o usuário precisa saber**: versão, se o aplicativo está
 * conectado ao próprio núcleo, com que privilégio está rodando e quando as
 * informações foram lidas. Caminho do banco, schema, alvo de compilação e
 * tamanho de arquivo são diagnóstico de desenvolvedor — saíram daqui.
 *
 * O perfil de compilação aparece somente em builds de desenvolvimento: numa
 * instalação real ele seria ruído.
 */
export function AppStatusCard({ privileges, collectedAt }: AppStatusCardProps) {
  const runtime = useAsync(getAppRuntimeInfo);
  const connected = isTauriAvailable();
  const privilege = privileges != null ? privilegeLabel(privileges.isElevated) : null;

  const isDevBuild = runtime.data?.buildProfile === 'debug';

  return (
    /*
      Sem `h-full`: com o card enxuto depois da limpeza, esticá-lo até a altura
      da ficha técnica ao lado deixava um vazio maior que o próprio conteúdo.
      O `items-start` da grade cuida do alinhamento pelo topo.
    */
    <Card>
      <CardHeader
        icon={<Plug className="size-4" />}
        title="eloBoost"
        description="Estado do aplicativo neste computador."
        action={
          connected ? (
            <StatusBadge tone="ok" hint="O aplicativo está funcionando normalmente.">
              Conectado
            </StatusBadge>
          ) : (
            <StatusBadge
              tone="attention"
              hint="Rodando no navegador: as funções que dependem do sistema não estão disponíveis."
            >
              Somente interface
            </StatusBadge>
          )
        }
      />

      <CardBody>
        {runtime.status === 'error' && runtime.error != null ? (
          <ErrorState error={runtime.error} onRetry={runtime.reload} />
        ) : runtime.status === 'loading' || runtime.data == null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-5 w-full"
                {...(index > 0 ? { silent: true } : {})}
              />
            ))}
          </div>
        ) : (
          <div>
            <StatusLine icon={Tag} label="Versão">
              <span className="text-[0.8125rem] font-medium text-fg tabular" data-numeric>
                {runtime.data.version}
                {isDevBuild && (
                  <span className="ml-1.5 font-normal text-fg-muted">(desenvolvimento)</span>
                )}
              </span>
            </StatusLine>

            {privilege != null && (
              <StatusLine icon={ShieldCheck} label="Permissões">
                <StatusBadge
                  tone={
                    privilege.elevated === null ? 'unknown' : privilege.elevated ? 'info' : 'ok'
                  }
                  shield
                  hint={privilege.detail}
                >
                  {privilege.label}
                </StatusBadge>
              </StatusLine>
            )}

            {collectedAt != null && (
              <StatusLine
                icon={Clock3}
                label="Informações lidas"
                title={formatDateTime(collectedAt)}
              >
                <span className="block truncate text-[0.8125rem] font-medium text-fg">
                  {formatRelative(collectedAt)}
                </span>
              </StatusLine>
            )}
          </div>
        )}

        {privilege != null && privilege.elevated === false && (
          <p
            className={cn(
              'mt-4 rounded-[10px] border border-subtle bg-base/40 px-3.5 py-3',
              'text-[0.75rem] leading-relaxed text-fg-muted',
            )}
          >
            O eloBoost roda sem permissões de administrador. Quando uma ação precisar delas, ele
            explica o motivo e pede sua autorização antes.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
