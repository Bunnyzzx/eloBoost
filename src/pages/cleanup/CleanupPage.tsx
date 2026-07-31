import { motion } from 'framer-motion';
import { RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { CleanCategoryCard } from '@/components/domain/CleanCategoryCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaggerItem } from '@/components/motion/Stagger';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DURATION_S, EASE } from '@/constants/motion';
import { useCleanup } from '@/hooks/useCleanup';
import { CleanConfirmation } from '@/pages/cleanup/sections/CleanConfirmation';
import { CleanResultCard } from '@/pages/cleanup/sections/CleanResultCard';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

/** Faixa de seleção: marcar tudo e o total do que está marcado. */
function SelectionBar({
  selectableCount,
  selectedCount,
  totals,
  onSetAll,
  onClean,
}: {
  selectableCount: number;
  selectedCount: number;
  totals: { bytes: number; files: number; categories: number };
  onSetAll: (checked: boolean) => void;
  onClean: () => void;
}) {
  const allChecked = selectedCount === selectableCount && selectableCount > 0;
  const partial = selectedCount > 0 && !allChecked;

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
        <Checkbox
          checked={allChecked}
          indeterminate={partial}
          onCheckedChange={onSetAll}
          disabled={selectableCount === 0}
          label={allChecked ? 'Desmarcar todas' : 'Marcar todas as áreas'}
          description={`${formatCount(selectedCount)} de ${formatCount(selectableCount)} selecionadas`}
          className="w-auto"
        />

        <div className="flex items-center gap-4">
          {/* O total tem rótulo acessível próprio: sem ele, um leitor de tela
              anunciaria só "3,0 MB", sem dizer 3,0 MB de quê. */}
          <div
            className="text-right"
            role="status"
            aria-label={`Selecionado para remover: ${formatBytes(totals.bytes)} em ${formatCount(
              totals.files,
            )} arquivos`}
          >
            <p className="text-xl font-semibold text-fg tabular" data-numeric>
              {formatBytes(totals.bytes)}
            </p>
            <p className="text-[0.75rem] text-fg-muted tabular" data-numeric>
              {formatCount(totals.files)} {totals.files === 1 ? 'arquivo' : 'arquivos'}
            </p>
          </div>

          <Button
            variant="danger"
            onClick={onClean}
            disabled={totals.categories === 0}
            iconStart={<Trash2 className="size-4" />}
          >
            Limpar selecionadas
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Faixa de progresso durante a limpeza.
 *
 * Como no scanner, o percentual conta **áreas concluídas**. Um percentual por
 * bytes seria uma estimativa: o espaço só se confirma quando o arquivo sai.
 */
function CleaningBar({ percent, done, total }: { percent: number; done: number; total: number }) {
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-fg">Limpando…</p>
          <p className="shrink-0 text-[0.8125rem] text-fg-muted tabular" data-numeric>
            {formatCount(done)} de {formatCount(total)} áreas
          </p>
        </div>

        <ProgressBar
          value={done === 0 ? null : percent}
          label="Progresso da limpeza"
          className="mt-3"
        />

        <p className="mt-3 text-[0.75rem] text-fg-muted">
          Arquivos em uso por outros programas são preservados automaticamente.
        </p>
      </CardBody>
    </Card>
  );
}

export function CleanupPage() {
  const cleanup = useCleanup();
  const [confirming, setConfirming] = useState(false);

  const analyzing = cleanup.phase === 'previewing';
  const cleaning = cleanup.phase === 'cleaning';
  const showCards =
    cleanup.preview != null && (cleanup.phase === 'ready' || cleaning || cleanup.phase === 'done');

  const selectableCount = cleanup.preview?.selectableCategories ?? 0;

  const finishedCount = [...cleanup.progress.values()].filter(
    (result) =>
      cleanup.selected.has(result.category) &&
      result.status !== 'pending' &&
      result.status !== 'running',
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Limpeza"
        description="Escolha o que remover. O eloBoost mostra tudo antes, remove apenas o que você marcar e nunca toca em arquivos pessoais."
        action={
          cleanup.phase === 'idle' ? undefined : (
            <Button
              variant="secondary"
              onClick={cleanup.analyze}
              loading={analyzing}
              disabled={analyzing || cleaning}
              iconStart={analyzing ? undefined : <RotateCcw className="size-4" />}
            >
              {analyzing ? 'Analisando' : 'Analisar novamente'}
            </Button>
          )
        }
      />

      {cleanup.phase === 'idle' && (
        <EmptyState
          icon={Sparkles}
          title="Vamos ver o que dá para liberar"
          description="A análise percorre as áreas descartáveis do Windows e mostra quanto espaço cada uma ocupa. Você escolhe o que remover — nada acontece antes disso."
          action={
            <Button onClick={cleanup.analyze} iconStart={<Sparkles className="size-4" />}>
              Analisar computador
            </Button>
          }
          note="Nenhum arquivo é removido durante a análise."
        />
      )}

      {analyzing && (
        <Card>
          <CardBody className="p-5">
            <p className="text-sm font-medium text-fg">Analisando o computador…</p>
            <ProgressBar value={null} label="Progresso da análise" className="mt-3" />
            <p className="mt-3 text-[0.75rem] text-fg-muted">
              Somente leitura: nada está sendo alterado neste momento.
            </p>
          </CardBody>
        </Card>
      )}

      {cleanup.phase === 'error' && cleanup.error != null && (
        <ErrorState error={cleanup.error} onRetry={cleanup.analyze} />
      )}

      {cleanup.phase === 'ready' && selectableCount === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="Não há nada para limpar"
          description="Todas as áreas descartáveis já estão vazias neste computador. Volte depois de usar o Windows por alguns dias."
          note="Nenhum arquivo foi removido."
        />
      )}

      {cleanup.phase === 'ready' && selectableCount > 0 && (
        <SelectionBar
          selectableCount={selectableCount}
          selectedCount={cleanup.selected.size}
          totals={cleanup.totals}
          onSetAll={cleanup.setAll}
          onClean={() => setConfirming(true)}
        />
      )}

      {cleaning && (
        <CleaningBar percent={cleanup.percent} done={finishedCount} total={cleanup.selected.size} />
      )}

      {cleanup.phase === 'done' && cleanup.report != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION_S.base, ease: EASE }}
        >
          <CleanResultCard report={cleanup.report} />
        </motion.div>
      )}

      {showCards && cleanup.preview != null && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cleanup.preview.categories.map((preview, index) => (
            <StaggerItem key={preview.category} index={index}>
              <CleanCategoryCard
                preview={preview}
                result={cleanup.progress.get(preview.category)}
                checked={cleanup.selected.has(preview.category)}
                onToggle={() => cleanup.toggle(preview.category)}
                locked={cleaning || cleanup.phase === 'done'}
              />
            </StaggerItem>
          ))}
        </div>
      )}

      {showCards && (
        <p
          className={cn(
            'flex w-fit items-center gap-2 rounded-full border border-subtle',
            'bg-elevated px-3 py-1.5 text-[0.75rem] text-fg-muted',
          )}
        >
          <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-ok" strokeWidth={1.75} />
          {cleanup.phase === 'done'
            ? 'Somente as áreas marcadas foram limpas. Arquivos pessoais não foram tocados.'
            : 'Áreas pessoais aparecem medidas, mas nunca são limpas em lote.'}
        </p>
      )}

      <CleanConfirmation
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          cleanup.clean();
        }}
        preview={cleanup.preview}
        selected={cleanup.selected}
        totals={cleanup.totals}
      />
    </div>
  );
}
