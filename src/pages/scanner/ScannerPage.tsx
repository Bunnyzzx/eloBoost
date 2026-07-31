import { motion } from 'framer-motion';
import { RotateCcw, ScanSearch, ShieldCheck } from 'lucide-react';

import { ScanCategoryCard } from '@/components/domain/ScanCategoryCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaggerItem } from '@/components/motion/Stagger';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DURATION_S, EASE } from '@/constants/motion';
import { useScan } from '@/hooks/useScan';
import { ScanSummaryCard } from '@/pages/scanner/sections/ScanSummaryCard';
import { cn } from '@/utils/cn';
import { formatCount } from '@/utils/format';

/**
 * Faixa de progresso exibida durante a análise.
 *
 * O percentual conta **categorias concluídas**, não bytes: não há como saber o
 * total antes de percorrer, e uma barra baseada em estimativa de tamanho
 * andaria para trás. Enquanto nenhuma categoria respondeu, a barra fica
 * indeterminada — que é a verdade naquele instante.
 */
function ScanProgress({
  progress,
  finished,
  total,
}: {
  progress: number;
  finished: number;
  total: number;
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-fg">Analisando o computador…</p>
          <p className="shrink-0 text-[0.8125rem] text-fg-muted tabular" data-numeric>
            {formatCount(finished)} de {formatCount(total)} áreas
          </p>
        </div>

        <ProgressBar
          value={finished === 0 ? null : progress}
          label="Progresso da análise"
          className="mt-3"
        />

        <p className="mt-3 text-[0.75rem] text-fg-muted">
          Cada área aparece assim que termina. Nada está sendo alterado no seu computador.
        </p>
      </CardBody>
    </Card>
  );
}

/** Aviso permanente de que a tela inteira é somente leitura. */
function ReadOnlyNotice() {
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded-full border border-subtle bg-elevated',
        'px-3 py-1.5 text-[0.75rem] text-fg-muted',
      )}
    >
      <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-ok" strokeWidth={1.75} />
      Análise somente leitura
    </p>
  );
}

export function ScannerPage() {
  const scan = useScan();

  const running = scan.phase === 'preparing' || scan.phase === 'running';
  const showCards = scan.categories.length > 0 && scan.phase !== 'idle' && scan.phase !== 'error';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analisar computador"
        description="O eloBoost percorre as áreas onde o Windows acumula arquivos descartáveis e mostra quanto espaço cada uma ocupa. Nada é removido."
        action={
          /*
            Na primeira abertura o botão vive só no estado vazio: dois botões
            idênticos na mesma tela seriam ruído visual e, para quem usa leitor
            de tela, duas ações com o mesmo nome sem diferença entre elas.
          */
          scan.phase === 'idle' ? undefined : (
            <div className="flex items-center gap-3">
              {scan.phase === 'done' && <ReadOnlyNotice />}
              <Button
                onClick={scan.start}
                loading={running}
                disabled={running}
                iconStart={running ? undefined : <RotateCcw className="size-4" />}
              >
                {running ? 'Analisando' : 'Analisar novamente'}
              </Button>
            </div>
          )
        }
      />

      {scan.phase === 'idle' && (
        <EmptyState
          icon={ScanSearch}
          title="Nenhuma análise feita ainda"
          description={
            <>
              A análise percorre {formatCount(scan.categories.length || 7)} áreas conhecidas do
              Windows — temporários, lixeira, miniaturas, registros, cache de navegadores e
              downloads — e informa quanto espaço cada uma ocupa.
            </>
          }
          action={
            <Button onClick={scan.start} iconStart={<ScanSearch className="size-4" />}>
              Analisar computador
            </Button>
          }
          note="Somente leitura: nenhum arquivo é aberto, alterado ou removido."
        />
      )}

      {scan.phase === 'error' && scan.error != null && (
        <ErrorState error={scan.error} onRetry={scan.start} />
      )}

      {running && (
        <ScanProgress
          progress={scan.progress}
          finished={scan.finished.size}
          total={scan.categories.length}
        />
      )}

      {scan.phase === 'done' && scan.summary != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION_S.base, ease: EASE }}
        >
          <ScanSummaryCard summary={scan.summary} />
        </motion.div>
      )}

      {showCards && (
        /* Sem `items-start`: os cards são todos do mesmo tipo, então as linhas
           esticadas ficam alinhadas em vez de irregulares. O `h-full` do card
           faz o resto. */
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {scan.categories.map((category, index) => (
            <StaggerItem key={category.category} index={index}>
              <ScanCategoryCard scan={category} pending={!scan.finished.has(category.category)} />
            </StaggerItem>
          ))}
        </div>
      )}
    </div>
  );
}
