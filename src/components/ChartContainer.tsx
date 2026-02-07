'use client';

import { ReactNode } from 'react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartContainer({ title, subtitle, children }: ChartContainerProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-3 sm:p-4 md:p-5">
      <div className="mb-3 sm:mb-4 md:mb-6">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-dimmed">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
