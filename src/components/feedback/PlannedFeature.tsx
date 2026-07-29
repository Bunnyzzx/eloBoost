import type { LucideIcon } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

export interface PlannedFeatureProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** O que esta tela fará quando for implementada. */
  scope: string[];
  /** Etapa do roadmap que entrega a funcionalidade (docs/09). */
  plannedIn: string;
}

/**
 * Tela ainda não implementada.
 *
 * Existe para deixar explícito que a navegação está pronta e a funcionalidade
 * não — em vez de exibir dados simulados que passariam a impressão de um
 * recurso funcionando. Nenhum número aqui é inventado; o conteúdo é a lista do
 * que a tela fará, extraída do planejamento.
 */
export function PlannedFeature({
  icon,
  title,
  description,
  scope,
  plannedIn,
}: PlannedFeatureProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <EmptyState
        icon={icon}
        title="Esta tela ainda não foi implementada"
        description={
          <>
            <p>A navegação e o design system já estão prontos. Quando esta etapa for concluída, aqui você verá:</p>
            <ul className="mx-auto mt-3 max-w-md list-inside list-disc space-y-1 text-left text-fg-secondary">
              {scope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        }
        note={`Planejado para: ${plannedIn}`}
      />
    </div>
  );
}
