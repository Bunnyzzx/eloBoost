import { Boxes } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function InstalledAppsPage() {
  return (
    <PlannedFeature
      icon={Boxes}
      title="Aplicativos instalados"
      description="Programas instalados neste computador, com desinstalação pelo desinstalador oficial de cada um."
      scope={[
        'Nome, ícone, desenvolvedor, versão, data e tamanho estimado',
        'Filtros por tamanho, nome, data e desenvolvedor',
        'Desinstalação sempre pelo desinstalador registrado pelo próprio programa',
        'Reparo, quando o aplicativo oferece essa opção',
        'O eloBoost nunca apaga a pasta de um aplicativo por conta própria',
      ]}
      plannedIn="Épico 8 — Inicialização e aplicativos"
    />
  );
}
