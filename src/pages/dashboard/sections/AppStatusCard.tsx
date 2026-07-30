import { Plug } from 'lucide-react';

import { InfoList, InfoRow } from '@/components/domain/InfoRow';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getDatabaseStatus } from '@/services/appService';
import { isTauriAvailable } from '@/services/ipc';
import { getAppRuntimeInfo, privilegeLabel } from '@/services/systemService';
import type { PrivilegeInfo } from '@/types/system';
import { formatBytes, formatDateTime } from '@/utils/format';

export interface AppStatusCardProps {
  privileges: PrivilegeInfo | null;
  /** Quanto tempo a última coleta levou no backend. */
  collectionMs: number | null;
  /** Quando a última coleta aconteceu. */
  collectedAt: string | null;
}

/**
 * Diagnóstico do aplicativo: versão, build, banco local, comunicação e
 * privilégio.
 *
 * Exercita o caminho completo até o backend, então também serve de verificação:
 * se algo estiver quebrado na cadeia interface → comando → Rust → SQLite, o
 * problema aparece aqui em vez de falhar em silêncio.
 */
export function AppStatusCard({ privileges, collectionMs, collectedAt }: AppStatusCardProps) {
  const runtime = useAsync(getAppRuntimeInfo);
  const database = useAsync(getDatabaseStatus);
  const connected = isTauriAvailable();

  const privilege = privileges != null ? privilegeLabel(privileges.isElevated) : null;

  return (
    <Card className="h-full">
      <CardHeader
        icon={<Plug className="size-4" />}
        title="eloBoost"
        description="Versão, dados locais e estado da comunicação com o núcleo."
        action={
          connected ? (
            <StatusBadge tone="ok" hint="A interface está conversando com o backend nativo.">
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
          <div>
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : (
          <InfoList>
            <InfoRow label="Versão" value={runtime.data.version} selectable numeric />
            <InfoRow label="Perfil de compilação" value={runtime.data.buildProfile} />
            <InfoRow
              label="Alvo do build"
              value={runtime.data.target}
              hint="Plataforma para a qual este executável foi compilado."
              selectable
            />

            {privilege != null && (
              <InfoRow
                label="Privilégio"
                value={
                  <StatusBadge
                    tone={
                      privilege.elevated === null ? 'unknown' : privilege.elevated ? 'info' : 'ok'
                    }
                    shield
                    hint={privilege.detail}
                  >
                    {privilege.label}
                  </StatusBadge>
                }
              />
            )}

            {database.status === 'error' && database.error != null ? (
              <div className="pt-3">
                <ErrorState error={database.error} onRetry={database.reload} />
              </div>
            ) : database.data != null ? (
              <>
                <InfoRow
                  label="Banco de dados"
                  value={`${formatBytes(database.data.sizeBytes)} · schema ${database.data.schemaVersion}`}
                  hint="Todos os dados do eloBoost ficam neste computador."
                  numeric
                />
                <InfoRow
                  label="Local dos dados"
                  value={database.data.databasePathMasked}
                  selectable
                />
              </>
            ) : (
              <SkeletonRow />
            )}

            {collectionMs != null && collectedAt != null && (
              <InfoRow
                label="Última leitura"
                value={`${formatDateTime(collectedAt)} · ${collectionMs} ms`}
                hint="Tempo que o backend levou para coletar as informações do sistema."
                numeric
              />
            )}
          </InfoList>
        )}
      </CardBody>
    </Card>
  );
}
