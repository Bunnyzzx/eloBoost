import { Zap } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function OptimizationsPage() {
  return (
    <PlannedFeature
      icon={Zap}
      title="Otimizações"
      description="Ajustes de desempenho documentados e reversíveis, com backup obrigatório antes de qualquer alteração."
      scope={[
        'Catálogo por categoria: desempenho, aparência, energia, privacidade, rede',
        'Valor atual e valor recomendado, lidos do sistema — nunca presumidos',
        'Benefício esperado, efeitos colaterais e nível de risco em cada ajuste',
        'Backup automático e botão de desfazer para cada alteração',
        'Área "Laboratório" isolada e desabilitada por padrão',
      ]}
      plannedIn="Épico 9 — Otimizações"
    />
  );
}
