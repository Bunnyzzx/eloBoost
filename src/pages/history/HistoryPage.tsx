import { History } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function HistoryPage() {
  return (
    <PlannedFeature
      icon={History}
      title="Histórico"
      description="Registro legível de tudo o que o eloBoost já fez neste computador."
      scope={[
        'Data, tipo de ação, resultado e itens afetados',
        'Espaço liberado e ajustes aplicados em cada operação',
        'Botão de desfazer quando a ação é reversível',
        'Exportação de relatório mediante autorização, com prévia do conteúdo',
      ]}
      plannedIn="Épico 4 — Histórico, backup e configurações"
    />
  );
}
