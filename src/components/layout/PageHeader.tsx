import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description != null && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-secondary">
            {description}
          </p>
        )}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}
