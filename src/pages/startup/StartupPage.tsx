import { Power } from 'lucide-react';

import { PlannedFeature } from '@/components/feedback/PlannedFeature';

export function StartupPage() {
  return (
    <PlannedFeature
      icon={Power}
      title="Inicialização"
      description="Programas que iniciam junto com o Windows, com impacto estimado e reversão em um clique."
      scope={[
        'Itens do registro, da pasta Inicializar e do Agendador de Tarefas',
        'Editor, caminho, assinatura digital e impacto estimado',
        'Habilitar e desabilitar, sempre reversível',
        'Componentes essenciais do Windows protegidos contra desativação',
        'Serviços em seção avançada separada',
      ]}
      plannedIn="Épico 8 — Inicialização e aplicativos"
    />
  );
}
