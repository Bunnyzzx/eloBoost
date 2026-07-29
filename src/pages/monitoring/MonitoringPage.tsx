import { Activity } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function MonitoringPage() {
  return (
    <PlannedFeature
      icon={Activity}
      title="Monitoramento"
      description="Uso de recursos em tempo real, com a origem de cada métrica declarada."
      scope={[
        'CPU, memória, disco, rede e GPU em janelas de 60 s, 5 min e 15 min',
        'Processos que mais consomem recursos',
        'A fonte de cada métrica é exibida (WMI, contadores de desempenho, Win32)',
        'Sensores indisponíveis exibem "Informação não suportada neste dispositivo"',
      ]}
      plannedIn="Épico 12 — Processos e monitoramento"
    />
  );
}
