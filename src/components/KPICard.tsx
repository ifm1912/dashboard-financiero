'use client';

import { KeyboardEvent } from 'react';

interface KPICardProps {
  label: string;
  value: string;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
}

export function KPICard({ label, value, trend, subtitle, onClick, active }: KPICardProps) {
  const isPositive = trend ? trend.value >= 0 : true;
  const isClickable = !!onClick;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`group rounded-xl border p-3 sm:p-4 md:p-5 transition-all duration-200 hover:bg-bg-surface hover:border-border-default ${
        active
          ? 'border-accent ring-2 ring-accent/30 bg-bg-surface'
          : 'border-border-subtle bg-bg-surface/50'
      } ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-pressed={isClickable ? active : undefined}
    >
      {/* Label */}
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>

      {/* Value */}
      <p className="mt-3 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
        {value}
      </p>

      {/* Trend indicator */}
      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            isPositive
              ? 'bg-success-muted text-success'
              : 'bg-danger-muted text-danger'
          }`}>
            {isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs text-text-dimmed">{trend.label}</span>
        </div>
      )}

      {/* Subtitle - solo si no hay trend */}
      {subtitle && !trend && (
        <p className="mt-2 text-xs text-text-dimmed">{subtitle}</p>
      )}
    </div>
  );
}
