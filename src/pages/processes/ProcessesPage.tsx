import { ListTree } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function ProcessesPage() {
  return (
    <PlannedFeature
      icon={ListTree}
      title="Processos"
      description="Processos em execução, consumo de recursos e encerramento seguro."
      scope={[
        'PID, uso de CPU, memória e disco, atualizados automaticamente',
        'Caminho do executável, editor, assinatura digital e nível de integridade',
        'Encerrar processo e encerrar árvore, com confirmação adicional',
        'Processos críticos do sistema protegidos, verificados dinamicamente',
      ]}
      plannedIn="Épico 12 — Processos e monitoramento"
    />
  );
}
