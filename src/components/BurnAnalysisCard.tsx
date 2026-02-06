'use client';

import { formatCurrency } from '@/lib/data';

interface BurnAnalysisCardProps {
  burnRate: number;
  avgMonthlyInflow: number;
  netBurn: number;
  period: number;
}

export function BurnAnalysisCard({
  burnRate,
  avgMonthlyInflow,
  netBurn,
  period,
}: BurnAnalysisCardProps) {
  const coverageRatio = burnRate > 0
    ? (avgMonthlyInflow / burnRate) * 100
    : Infinity;

  const isPositive = netBurn <= 0;

  return (
    <div className="rounded-lg border border-border-subtle bg-white p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">
        Análisis de Burn
      </h3>

      {/* Burn Rate y Ingresos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Gastos Operativos</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCurrency(burnRate)}
              <span className="text-xs font-normal text-text-dimmed">/mes</span>
            </p>
          </div>
          <span className="text-xs text-text-dimmed">prom {period}m</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Ingresos Operativos</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCurrency(avgMonthlyInflow)}
              <span className="text-xs font-normal text-text-dimmed">/mes</span>
            </p>
          </div>
          <span className="text-xs text-text-dimmed">prom {period}m</span>
        </div>
      </div>

      {/* Separador */}
      <div className="my-4 border-t border-border-subtle" />

      {/* Net Burn y Ratio */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Net Burn</p>
            <p className={`text-lg font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : '-'}{formatCurrency(Math.abs(netBurn))}
              <span className="text-xs font-normal text-text-dimmed">/mes</span>
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isPositive
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {isPositive ? 'Generando' : 'Quemando'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Ratio de Cobertura</p>
            <p className="text-lg font-semibold text-text-primary">
              {isFinite(coverageRatio) ? `${coverageRatio.toFixed(0)}%` : '∞'}
            </p>
          </div>
          <span className="text-xs text-text-dimmed">
            {coverageRatio >= 100 ? '✓ Ingresos cubren gastos' : 'Ingresos / Gastos'}
          </span>
        </div>
      </div>
    </div>
  );
}
