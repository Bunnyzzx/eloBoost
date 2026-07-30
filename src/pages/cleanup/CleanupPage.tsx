import { Sparkles } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function CleanupPage() {
  return (
    <PlannedFeature
      icon={Sparkles}
      title="Limpeza"
      description="Análise e remoção segura de arquivos temporários, sempre em duas etapas: analisar, revisar e só então limpar."
      scope={[
        'Categorias de limpeza com os caminhos analisados sempre visíveis',
        'Análise prévia — nada é removido ao abrir a tela',
        'Modo de simulação (Dry Run), que informa sem remover',
        'Confirmação com total de arquivos, espaço estimado e avisos',
        'Progresso real com cancelamento seguro',
      ]}
      plannedIn="Épico 3 — Limpeza"
    />
  );
}
