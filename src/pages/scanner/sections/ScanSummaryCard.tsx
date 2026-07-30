import { Clock3, FileSearch, HardDrive, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardBody } from '@/components/ui/Card';
import { formatScanDuration } from '@/services/scannerService';
import type { ScanSummary } from '@/types/scanner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

export interface ScanSummaryCardProps {
  summary: ScanSummary;
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
 * Números finais da análise, mais o aviso de transparência.
 *
 * "Espaço recuperável" é deliberadamente diferente de "tudo o que foi medido":
 * Downloads é uma pasta pessoal, entra na medição e **não** entra na promessa
 * de espaço a liberar. Os dois números aparecem juntos justamente para que a
 * diferença seja visível, em vez de escondida numa nota de rodapé.
 */
export function ScanSummaryCard({ summary, className }: ScanSummaryCardProps) {
  const personalBytes = summary.measuredBytes - summary.reclaimableBytes;

  return (
    <Card highlighted className={className}>
      <CardBody className="p-5">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            icon={HardDrive}
            label="Espaço recuperável"
            value={formatBytes(summary.reclaimableBytes)}
            hint={
              personalBytes > 0
                ? `${formatBytes(personalBytes)} a mais em pastas suas, não incluídos`
                : undefined
            }
            emphasis
          />
          <Figure
            icon={FileSearch}
            label="Arquivos encontrados"
            value={formatCount(summary.totalFiles)}
            hint={`em ${formatCount(summary.totalFolders)} pastas`}
          />
          <Figure
            icon={Clock3}
            label="Tempo da análise"
            value={formatScanDuration(summary.durationMs)}
          />
          <Figure
            icon={FileSearch}
            label="Áreas medidas"
            value={`${formatCount(summary.measuredCategories)} de ${formatCount(summary.categories.length)}`}
            hint="as demais não existem neste computador"
          />
        </div>

        {/*
          O aviso de transparência exigido pelo produto. Fica junto do número
          grande de propósito: é exatamente ali que um utilitário de limpeza
          costuma sugerir que já fez alguma coisa.
        */}
        <div
          className={cn(
            'mt-6 flex items-start gap-3 rounded-[10px] border border-ok/30',
            'bg-ok-soft/40 px-4 py-3.5',
          )}
        >
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-ok" strokeWidth={1.75} />
          <p className="text-[0.8125rem] leading-relaxed text-fg-secondary">
            <strong className="font-medium text-fg">Nenhum arquivo foi removido.</strong> Esta foi
            apenas uma análise: o eloBoost mediu o espaço ocupado e não alterou nada no seu
            computador.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
