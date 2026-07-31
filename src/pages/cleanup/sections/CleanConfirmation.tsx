import { ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { CleanPreview } from '@/types/cleaner';
import type { ScanCategoryId } from '@/types/scanner';
import { cn } from '@/utils/cn';
import { formatBytes, formatCount } from '@/utils/format';

export interface CleanConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: CleanPreview | null;
  selected: ReadonlySet<ScanCategoryId>;
  totals: { bytes: number; files: number; categories: number };
}

/**
 * Confirmação da limpeza.
 *
 * O único modal do produto até aqui, e por um motivo: esta é a primeira ação do
 * eloBoost que não pode ser desfeita. Um diálogo que retém o foco e exige uma
 * decisão explícita é exatamente a interrupção que uma ação irreversível merece
 * — diferente de um pop-up de venda, que interrompe sem motivo.
 *
 * O resumo repete os números **e** lista as áreas pelo nome: confirmar "3,48 GB"
 * sem saber de onde eles vêm não é consentimento informado.
 */
export function CleanConfirmation({
  open,
  onClose,
  onConfirm,
  preview,
  selected,
  totals,
}: CleanConfirmationProps) {
  const names =
    preview?.categories.filter((item) => selected.has(item.category)).map((item) => item.name) ??
    [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar limpeza"
      description="Revise o que será removido. Esta ação não pode ser desfeita."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={totals.categories === 0}
            iconStart={<Trash2 className="size-4" />}
          >
            Limpar agora
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-[0.8125rem] text-fg-secondary">Você está prestes a remover</p>
          <p className="mt-1 text-3xl font-semibold text-fg tabular" data-numeric>
            {formatBytes(totals.bytes)}
          </p>
          <p className="mt-1 text-sm text-fg-secondary tabular" data-numeric>
            em {formatCount(totals.files)} {totals.files === 1 ? 'arquivo' : 'arquivos'}
          </p>
        </div>

        <div>
          <p className="text-[0.8125rem] font-medium text-fg">
            {names.length === 1 ? 'Área selecionada' : 'Áreas selecionadas'}
          </p>
          <ul className="mt-2 space-y-1.5">
            {names.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2.5 text-[0.8125rem] text-fg-secondary"
              >
                <span aria-hidden className="size-1 shrink-0 rounded-full bg-accent" />
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/*
          A promessa que o produto precisa fazer e cumprir. Não é decoração: a
          política está no tipo `RemovalPolicy` do backend, e há testes que
          quebram se uma pasta pessoal virar limpável em lote.
        */}
        <div
          className={cn(
            'flex items-start gap-3 rounded-[10px] border border-ok/30',
            'bg-ok-soft/40 px-4 py-3.5',
          )}
        >
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-ok" strokeWidth={1.75} />
          <p className="text-[0.8125rem] leading-relaxed text-fg-secondary">
            <strong className="font-medium text-fg">Nenhum arquivo pessoal será removido.</strong> A
            limpeza toca apenas as áreas descartáveis listadas acima — documentos, fotos e a pasta
            Downloads ficam de fora.
          </p>
        </div>
      </div>
    </Modal>
  );
}
