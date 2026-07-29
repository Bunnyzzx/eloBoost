import { Ban, Database, Info, ShieldCheck } from 'lucide-react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getAppInfo, getDatabaseStatus } from '@/services/appService';
import { isTauriAvailable } from '@/services/ipc';
import { formatBytes, formatDateTime } from '@/utils/format';

/** Compromissos do produto — exibidos ao usuário, não só na documentação. */
const NEVER_DOES: readonly string[] = [
  'Desativar o Windows Defender, o firewall ou o Windows Update',
  'Prometer ganho de FPS ou qualquer número de desempenho não medido',
  'Apagar arquivos pessoais sem seleção explícita, item a item',
  'Executar comandos arbitrários vindos da interface',
  'Rodar como administrador o tempo todo, ou contornar o UAC',
  'Coletar nomes de arquivos, documentos, senhas ou histórico de navegação',
  'Usar pop-ups agressivos ou padrões enganosos de compra',
];

function AppInfoCard() {
  const appInfo = useAsync(getAppInfo);

  return (
    <Card>
      <CardHeader
        icon={<Info className="size-4" />}
        title="Sobre o eloBoost"
        description="Utilitário de limpeza, manutenção e otimização segura para Windows 10 e 11."
      />
      <CardBody>
        {appInfo.status === 'loading' && <Skeleton className="h-16 w-full" />}

        {appInfo.status === 'error' && appInfo.error != null && (
          <ErrorState error={appInfo.error} onRetry={appInfo.reload} />
        )}

        {appInfo.status === 'success' && appInfo.data != null && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-fg-muted">Versão</dt>
              <dd className="mt-0.5 font-medium text-fg selectable" data-numeric>
                {appInfo.data.version}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Compilação</dt>
              <dd className="mt-0.5 font-medium text-fg">{appInfo.data.buildProfile}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-fg-muted">Ambiente</dt>
              <dd className="mt-1">
                {isTauriAvailable() ? (
                  <Badge tone="ok">Aplicativo desktop (Tauri)</Badge>
                ) : (
                  <Badge tone="attention">Navegador — funções de sistema indisponíveis</Badge>
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function DatabaseCard() {
  const database = useAsync(getDatabaseStatus);

  if (!isTauriAvailable()) {
    return (
      <Card>
        <CardHeader
          icon={<Database className="size-4" />}
          title="Banco de dados local"
          description="Diagnóstico do armazenamento local do eloBoost."
        />
        <CardBody>
          <p className="text-sm text-fg-secondary">
            O banco local só existe no aplicativo instalado. No navegador, apenas a interface é
            exibida.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<Database className="size-4" />}
        title="Banco de dados local"
        description="Todos os dados do eloBoost ficam neste computador."
        action={
          database.data != null ? (
            <Badge tone={database.data.healthy ? 'ok' : 'critical'}>
              {database.data.healthy ? 'Íntegro' : 'Requer atenção'}
            </Badge>
          ) : undefined
        }
      />
      <CardBody>
        {database.status === 'loading' && <Skeleton className="h-24 w-full" />}

        {database.status === 'error' && database.error != null && (
          <ErrorState error={database.error} onRetry={database.reload} showTechnicalDetails />
        )}

        {database.status === 'success' && database.data != null && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-fg-muted">Versão do schema</dt>
                <dd className="mt-0.5 font-medium text-fg tabular" data-numeric>
                  {database.data.schemaVersion} de {database.data.expectedVersion}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">Tamanho</dt>
                <dd className="mt-0.5 font-medium text-fg tabular" data-numeric>
                  {formatBytes(database.data.sizeBytes)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-muted">Local</dt>
                <dd className="mt-0.5 font-mono text-[0.75rem] text-fg-secondary selectable">
                  {database.data.databasePathMasked}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-[0.8125rem] font-semibold text-fg">Migrations aplicadas</h3>
              <ul className="mt-2 divide-y divide-subtle rounded-[8px] border border-subtle">
                {database.data.appliedMigrations.map((migration) => (
                  <li
                    key={migration.version}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-[0.8125rem]"
                  >
                    <span className="text-fg-secondary">
                      <span className="font-mono text-fg-muted tabular" data-numeric>
                        {String(migration.version).padStart(4, '0')}
                      </span>{' '}
                      {migration.name}
                    </span>
                    <span className="shrink-0 text-fg-muted tabular" data-numeric>
                      {formatDateTime(migration.appliedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sobre"
        description="Versão, diagnóstico local e os compromissos que o eloBoost assume com você."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <AppInfoCard />
        <DatabaseCard />
      </div>

      <Card>
        <CardHeader
          icon={<Ban className="size-4" />}
          title="O que o eloBoost nunca faz"
          description="Estes limites são parte da arquitetura do produto, não apenas uma promessa."
        />
        <CardBody>
          <ul className="space-y-2">
            {NEVER_DOES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-fg-secondary">
                <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
                {item}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<ShieldCheck className="size-4" />}
          title="Como o eloBoost protege seus dados"
          description="Resumo do modelo de segurança documentado no repositório."
        />
        <CardBody>
          <ul className="space-y-2 text-sm text-fg-secondary">
            <li>• Toda alteração de configuração cria um backup antes de ser aplicada.</li>
            <li>• Nenhum arquivo é removido sem análise prévia e confirmação explícita.</li>
            <li>
              • A interface não constrói caminhos de arquivo: ela só manipula identificadores
              devolvidos pelo backend.
            </li>
            <li>• A elevação de privilégio é pedida por operação, com explicação antes do UAC.</li>
            <li>• Os logs não registram senhas, tokens nem conteúdo de arquivos.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
