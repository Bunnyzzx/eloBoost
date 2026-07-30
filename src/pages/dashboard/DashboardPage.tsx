import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaggerItem } from '@/components/motion/Stagger';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getAppInfo, getDatabaseStatus } from '@/services/appService';
import { isTauriAvailable } from '@/services/ipc';
import { formatBytes } from '@/utils/format';

function StatusRow({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention';
}) {
  const toneClass =
    tone === 'ok' ? 'text-ok' : tone === 'attention' ? 'text-attention' : 'text-fg-secondary';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-subtle py-2.5 last:border-0">
      <span className="flex items-center gap-2.5 text-sm text-fg-secondary">
        <span aria-hidden className={toneClass}>
          {icon}
        </span>
        {label}
      </span>
      <span className="text-sm font-medium text-fg tabular" data-numeric>
        {value}
      </span>
    </div>
  );
}

/**
 * Diagnóstico do núcleo — a única informação real disponível no Épico 0.
 *
 * Exercita o caminho completo: página → serviço → validação Zod → comando
 * Tauri → Rust → SQLite → resposta tipada. Se algo estiver quebrado nessa
 * cadeia, ele aparece aqui em vez de falhar silenciosamente.
 */
function CoreStatusCard() {
  const appInfo = useAsync(getAppInfo);
  const database = useAsync(getDatabaseStatus);
  const inTauri = isTauriAvailable();

  return (
    <Card>
      <CardHeader
        icon={<Plug className="size-4" />}
        title="Núcleo do aplicativo"
        description="Estado da comunicação entre a interface e o backend."
        action={
          inTauri ? (
            <Badge tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
              Conectado
            </Badge>
          ) : (
            <Badge tone="attention" icon={<MonitorSmartphone className="size-3.5" />}>
              Somente interface
            </Badge>
          )
        }
      />
      <CardBody>
        {appInfo.status === 'loading' && <Skeleton className="h-24 w-full" />}

        {appInfo.status === 'error' && appInfo.error != null && (
          <ErrorState error={appInfo.error} onRetry={appInfo.reload} />
        )}

        {appInfo.status === 'success' && appInfo.data != null && (
          <div>
            <StatusRow
              icon={<ShieldCheck className="size-4" />}
              label="Versão"
              value={`${appInfo.data.name} ${appInfo.data.version}`}
              tone="ok"
            />
            <StatusRow
              icon={<Activity className="size-4" />}
              label="Perfil de compilação"
              value={appInfo.data.buildProfile}
            />

            {!inTauri ? (
              <StatusRow
                icon={<Database className="size-4" />}
                label="Banco de dados local"
                value="Indisponível no navegador"
                tone="attention"
              />
            ) : database.status === 'success' && database.data != null ? (
              <>
                <StatusRow
                  icon={<Database className="size-4" />}
                  label="Versão do schema"
                  value={`${database.data.schemaVersion} de ${database.data.expectedVersion}`}
                  tone={database.data.healthy ? 'ok' : 'attention'}
                />
                <StatusRow
                  icon={<Database className="size-4" />}
                  label="Tamanho do banco"
                  value={formatBytes(database.data.sizeBytes)}
                />
              </>
            ) : database.status === 'error' && database.error != null ? (
              <div className="pt-3">
                <ErrorState error={database.error} onRetry={database.reload} />
              </div>
            ) : (
              <Skeleton className="mt-3 h-12 w-full" />
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description="Aqui ficará a visão geral do computador: saúde do sistema, uso de recursos e o resultado da análise."
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <StaggerItem index={0}>
          <CoreStatusCard />
        </StaggerItem>

        <StaggerItem index={1}>
          <Card>
            <CardHeader
              icon={<Gauge className="size-4" />}
              title="Saúde do sistema"
              description="Indicador com critérios transparentes, baseado em dados reais do computador."
            />
            <CardBody>
              <div className="rounded-[10px] border border-dashed border-strong bg-base/40 px-4 py-5 text-center">
                <p className="text-sm text-fg-secondary">
                  Ainda não implementado. Os critérios de saúde dependem da leitura real do sistema.
                </p>
                <p className="mt-2 text-[0.75rem] text-fg-muted">
                  Planejado para: Épico 1 (informações do sistema) e Épico 5 (motor de saúde)
                </p>
              </div>

              <ul className="mt-4 space-y-1.5 text-[0.8125rem] text-fg-secondary">
                <li>• Espaço livre em disco</li>
                <li>• Quantidade de programas na inicialização</li>
                <li>• Arquivos temporários acumulados</li>
                <li>• Existência de ponto de restauração recente</li>
                <li>• Uso anormal de recursos</li>
              </ul>
              <p className="mt-3 text-[0.75rem] text-fg-muted">
                Cada critério exibirá o valor observado e o peso no cálculo. Nenhum número será
                estimado ou inventado.
              </p>
            </CardBody>
          </Card>
        </StaggerItem>
      </div>
    </div>
  );
}
