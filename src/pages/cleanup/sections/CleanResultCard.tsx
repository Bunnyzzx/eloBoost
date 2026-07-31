import { AlertTriangle, CheckCircle2, Clock3, FileMinus, HardDrive, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardBody } from '@/components/ui/Card';
import { formatCleanDuration, headlineForOutcome, toneForOutcome } from '@/services/cleanerService';
import type { CleanReport } from '@/types/cleaner';
import { totalCleanSkips } from '@/types/cleaner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

export interface CleanResultCardProps {
  report: CleanReport;
  className?: string;
}

function Figure({
  icon: Icon,
  label,
  value,
  hint,
  emphasis = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-[0.75rem] text-fg-muted">
        <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 font-semibold break-words text-fg tabular',
          emphasis ? 'text-3xl' : 'text-xl',
        )}
        data-numeric
      >
        {value}
      </p>
      {hint != null && <p className="mt-1 text-[0.75rem] text-fg-muted">{hint}</p>}
    </div>
  );
}

/**
 * Lista apenas os motivos que de fato ocorreram, no singular ou plural certo.
 *
 * A versão anterior imprimia "0 em uso · 0 sem permissão · 1 atalhos", que erra
 * a concordância e ainda enche a frase de zeros irrelevantes.
 */
function keptBreakdown(report: CleanReport): string[] {
  const partes: string[] = [];

  const push = (count: number, singular: string, plural: string) => {
    if (count > 0) partes.push(`${formatCount(count)} ${count === 1 ? singular : plural}`);
  };

  push(
    report.skipped.inUse,
    'arquivo em uso por outro programa',
    'arquivos em uso por outros programas',
  );
  push(report.skipped.accessDenied, 'arquivo sem permissão', 'arquivos sem permissão');
  push(report.skipped.links, 'atalho preservado', 'atalhos preservados');
  push(report.skipped.pathTooLong, 'caminho longo demais', 'caminhos longos demais');
  push(report.skipped.alreadyGone, 'arquivo que já não existia', 'arquivos que já não existiam');
  push(
    report.skipped.rejectedByGuard,
    'item fora da área permitida',
    'itens fora da área permitida',
  );
  push(report.skipped.otherFailures, 'falha de remoção', 'falhas de remoção');

  return partes;
}

const OUTCOME_ICON = {
  ok: CheckCircle2,
  attention: AlertTriangle,
  critical: XCircle,
  info: CheckCircle2,
  unknown: CheckCircle2,
} as const;

/**
 * O resultado da limpeza.
 *
 * Mostra os cinco números que o produto prometeu — espaço liberado, arquivos
 * removidos, itens mantidos, falhas e tempo — e não esconde nenhum deles atrás
 * de um "concluído!" genérico.
 *
 * A distinção entre **mantidos** e **falhas** é deliberada: um arquivo em uso
 * que o eloBoost preservou não é o mesmo que um erro de remoção, e juntá-los
 * apagaria justamente o caso em que o produto agiu com cautela.
 */
export function CleanResultCard({ report, className }: CleanResultCardProps) {
  const tone = toneForOutcome(report.outcome);
  const Icon = OUTCOME_ICON[tone];
  const kept = totalCleanSkips(report.skipped);
  const failures = report.skipped.otherFailures + report.skipped.rejectedByGuard;

  return (
    <Card highlighted className={className}>
      <CardBody className="p-5">
        <div className="flex items-center gap-2.5">
          <Icon
            aria-hidden
            className={cn(
              'size-5 shrink-0',
              tone === 'ok' ? 'text-ok' : tone === 'attention' ? 'text-attention' : 'text-critical',
            )}
            strokeWidth={1.75}
          />
          <h2 className="text-base font-semibold text-fg">{headlineForOutcome(report.outcome)}</h2>
        </div>

        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            icon={HardDrive}
            label="Espaço liberado"
            value={formatBytes(report.freedBytes)}
            emphasis
          />
          <Figure
            icon={FileMinus}
            label="Arquivos removidos"
            value={formatCount(report.removedFiles)}
            hint={
              report.removedFolders > 0
                ? `e ${formatCount(report.removedFolders)} pastas vazias`
                : undefined
            }
          />
          <Figure
            icon={AlertTriangle}
            label="Itens mantidos"
            value={formatCount(kept)}
            hint={failures > 0 ? `${formatCount(failures)} por falha de remoção` : 'nenhuma falha'}
          />
          <Figure
            icon={Clock3}
            label="Tempo total"
            value={formatCleanDuration(report.durationMs)}
            hint={`${formatCount(report.executedCategories)} ${
              report.executedCategories === 1 ? 'área limpa' : 'áreas limpas'
            }`}
          />
        </div>

        {kept > 0 && (
          <p className="mt-5 rounded-[10px] border border-subtle bg-base/40 px-4 py-3 text-[0.8125rem] leading-relaxed text-fg-secondary">
            {keptBreakdown(report).join(' · ')}. Esses itens continuam no seu computador
            {report.skipped.inUse > 0
              ? ' — feche os programas relacionados e analise de novo para tentar outra vez.'
              : '.'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
