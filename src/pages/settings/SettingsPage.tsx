import { Settings } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function SettingsPage() {
  return (
    <PlannedFeature
      icon={Settings}
      title="Configurações"
      description="Preferências do aplicativo, guardadas localmente no seu computador."
      scope={[
        'Tema, idioma, escala da interface e animações',
        'Criar ponto de restauração automaticamente e confirmar antes de limpar',
        'Exclusões de pastas e de aplicativos',
        'Telemetria — desativada por padrão, com a lista exata do que seria enviado',
        'Apagar dados locais e restaurar configurações padrão',
      ]}
      plannedIn="Épico 4 — Histórico, backup e configurações"
    />
  );
}
