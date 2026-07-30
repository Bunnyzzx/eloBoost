import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { DURATION_S, EASE } from '@/constants/motion';
import { useAsync } from '@/hooks/useAsync';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { HardwareOverview } from '@/pages/dashboard/sections/HardwareOverview';
import { AppStatusCard } from '@/pages/dashboard/sections/AppStatusCard';
import { StorageSection } from '@/pages/dashboard/sections/StorageSection';
import { SystemDetailsCard } from '@/pages/dashboard/sections/SystemDetailsCard';
import { getSystemSnapshot } from '@/services/systemService';
import { availableValue } from '@/types/system';
import { formatRelative } from '@/utils/format';

/** Saudação conforme a hora local — um detalhe pequeno que humaniza a abertura. */
function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function DashboardPage() {
  const snapshot = useAsync(getSystemSnapshot);
  const reduceMotion = useReducedMotion();

  const data = snapshot.data;
  const firstLoad = snapshot.status === 'loading';
  const os = data?.os;

  const userName = os != null ? availableValue(os.userName) : null;
  const build = os != null ? availableValue(os.build) : null;

  // Linha de contexto: nome da máquina, edição do sistema (ou o nome genérico,
  // quando a edição não é legível) e o build. Partes ausentes simplesmente não
  // aparecem — sem placeholders nem texto inventado.
  const subtitle =
    os == null
      ? ''
      : [
          availableValue(os.computerName),
          availableValue(os.edition) ?? availableValue(os.name),
          build != null ? `build ${build}` : null,
        ]
          .filter((part): part is string => part != null && part.length > 0)
          .join(' · ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={userName != null ? `${greeting()}, ${userName}` : greeting()}
        description={
          firstLoad ? (
            <Skeleton className="mt-1 h-4 w-72" label="Carregando informações do computador" />
          ) : subtitle.length > 0 ? (
            subtitle
          ) : (
            'Informações do computador, lidas diretamente do sistema.'
          )
        }
        action={
          <div className="flex items-center gap-3">
            {data != null && (
              <span className="hidden text-[0.75rem] text-fg-muted sm:inline">
                atualizado {formatRelative(data.collectedAt)}
              </span>
            )}
            <Button
              variant="secondary"
              onClick={snapshot.reload}
              loading={snapshot.isRefreshing}
              disabled={firstLoad}
              iconStart={
                /* O ícone gira apenas durante a atualização; parado, não custa
                   nada. Com movimento reduzido, o estado é comunicado pelo
                   texto do botão e por `aria-busy`. */
                snapshot.isRefreshing || reduceMotion ? undefined : <RefreshCw className="size-4" />
              }
            >
              {snapshot.isRefreshing ? 'Atualizando' : 'Atualizar'}
            </Button>
          </div>
        }
      />

      {snapshot.status === 'error' && snapshot.error != null ? (
        <ErrorState error={snapshot.error} onRetry={snapshot.reload} />
      ) : (
        /*
          A atualização atenua o conteúdo em 4%, o suficiente para o olho notar
          que algo aconteceu sem esconder o dado anterior — que continua legível
          e correto até o novo chegar. Nada é desmontado, então não há piscada.
        */
        <motion.div
          animate={{ opacity: snapshot.isRefreshing && !reduceMotion ? 0.96 : 1 }}
          transition={{ duration: DURATION_S.instant, ease: EASE }}
          className="space-y-5"
          aria-busy={snapshot.isRefreshing}
        >
          <HardwareOverview snapshot={data} loading={firstLoad} />

          <StorageSection disks={data?.disks ?? null} loading={firstLoad} />

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <SystemDetailsCard snapshot={data} loading={firstLoad} />
            <AppStatusCard
              privileges={data?.privileges ?? null}
              collectedAt={data?.collectedAt ?? null}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
