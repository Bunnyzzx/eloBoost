import { RotateCcw } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function RestorePage() {
  return (
    <PlannedFeature
      icon={RotateCcw}
      title="Restauração"
      description="Pontos de restauração do Windows e backups internos criados antes de cada alteração."
      scope={[
        'Pontos de restauração do Windows, incluindo os criados por outros programas',
        'Backups do eloBoost com a lista exata de alterações incluídas',
        'Restaurar, excluir e exportar relatório',
        'Recuperação de alterações interrompidas por queda de energia',
      ]}
      plannedIn="Épico 10 — Restauração"
    />
  );
}
