import { BarChart3 } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function StoragePage() {
  return (
    <PlannedFeature
      icon={BarChart3}
      title="Armazenamento"
      description="Onde o espaço do disco está sendo usado, com análise rápida ou profunda."
      scope={[
        'Espaço por disco e por categoria de arquivo',
        'Maiores pastas, arquivos grandes e arquivos antigos',
        'Possíveis duplicados comparados por tamanho e hash, nunca só pelo nome',
        'Nada é removido automaticamente — você escolhe qual cópia manter',
      ]}
      plannedIn="Épico 11 — Armazenamento"
    />
  );
}
