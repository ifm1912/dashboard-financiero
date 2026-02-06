'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { KPICard } from '@/components';
import { getMRRMetrics, formatCurrency, formatMonth, filterMRRByDate } from '@/lib/data';
import { MRRMetric } from '@/types';
import { useDateRange } from '@/contexts';

interface MRRTableRow {
  month: string;
  monthLabel: string;
  mrr: number;
  arr: number;
  deltaMRR: number;
  deltaPercent: number;
}

const CHART_COLORS = {
  primary: '#4f46e5',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border-default bg-chart-tooltip-bg px-3 py-2 shadow-2xl backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-dimmed">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MRRPage() {
  const [mrrData, setMrrData] = useState<MRRMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const { dateRange } = useDateRange();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getMRRMetrics();
        setMrrData(data);
      } catch (error) {
        console.error('Error loading MRR data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtrar MRR por rango de fechas
  const filteredMRR = useMemo(() => {
    return filterMRRByDate(mrrData, dateRange);
  }, [mrrData, dateRange]);

  const kpis = useMemo(() => {
    if (filteredMRR.length === 0) {
      return { currentMRR: 0, currentARR: 0, deltaMRR: 0, deltaPercent: 0 };
    }

    const current = filteredMRR[filteredMRR.length - 1];
    const previous = filteredMRR.length > 1 ? filteredMRR[filteredMRR.length - 2] : null;
    const deltaMRR = previous ? current.mrr_approx - previous.mrr_approx : 0;
    const deltaPercent = previous && previous.mrr_approx > 0
      ? ((current.mrr_approx - previous.mrr_approx) / previous.mrr_approx) * 100
      : 0;

    return {
      currentMRR: current.mrr_approx,
      currentARR: current.arr_approx,
      deltaMRR,
      deltaPercent,
    };
  }, [filteredMRR]);

  const chartData = useMemo(() => {
    return filteredMRR.map(d => ({
      month: d.month,
      monthLabel: formatMonth(d.month),
      mrr: d.mrr_approx,
      arr: d.arr_approx,
    }));
  }, [filteredMRR]);

  const tableData = useMemo((): MRRTableRow[] => {
    return filteredMRR.map((d, index) => {
      const previous = index > 0 ? filteredMRR[index - 1] : null;
      const deltaMRR = previous ? d.mrr_approx - previous.mrr_approx : 0;
      const deltaPercent = previous && previous.mrr_approx > 0
        ? ((d.mrr_approx - previous.mrr_approx) / previous.mrr_approx) * 100
        : 0;

      return {
        month: d.month,
        monthLabel: formatMonth(d.month),
        mrr: d.mrr_approx,
        arr: d.arr_approx,
        deltaMRR,
        deltaPercent,
      };
    });
  }, [filteredMRR]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Note */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface/30 px-4 py-2.5">
        <p className="text-[11px] text-text-dimmed">
          MRR aproximado basado en fecha de emisión. Solo facturas con revenue_category = recurring.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard
          label="MRR Actual"
          value={formatCurrency(kpis.currentMRR)}
          subtitle="Último mes del período"
        />
        <KPICard
          label="ARR Actual"
          value={formatCurrency(kpis.currentARR)}
          subtitle="MRR × 12"
        />
        <KPICard
          label="Variación MRR"
          value={`${kpis.deltaMRR >= 0 ? '+' : ''}${formatCurrency(kpis.deltaMRR)}`}
          trend={{
            value: kpis.deltaPercent,
            label: 'vs mes anterior'
          }}
        />
      </div>

      {/* MRR Evolution Chart */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary">Evolución del MRR</h3>
          <p className="mt-0.5 text-xs text-text-dimmed">Monthly Recurring Revenue histórico</p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke={CHART_COLORS.text}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke={CHART_COLORS.text}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="mrr"
                name="MRR"
                stroke={CHART_COLORS.primary}
                strokeWidth={1.5}
                fill="url(#mrrGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary">Detalle Mensual</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border-subtle">
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Mes</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">MRR</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Δ MRR</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Δ %</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">ARR</th>
              </tr>
            </thead>
            <tbody>
              {tableData.slice().reverse().map((row, index) => (
                <tr
                  key={row.month}
                  className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                >
                  <td className="px-5 py-3 text-sm text-text-primary">
                    {row.monthLabel}
                    {index === 0 && (
                      <span className="ml-2 text-[10px] text-accent-light font-medium">Actual</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                    {formatCurrency(row.mrr)}
                  </td>
                  <td className={`px-5 py-3 text-sm text-right font-mono ${
                    row.deltaMRR > 0 ? 'text-success' : row.deltaMRR < 0 ? 'text-danger' : 'text-text-dimmed'
                  }`}>
                    {row.deltaMRR !== 0 ? (row.deltaMRR > 0 ? '+' : '') + formatCurrency(row.deltaMRR) : '—'}
                  </td>
                  <td className={`px-5 py-3 text-sm text-right ${
                    row.deltaPercent > 0 ? 'text-success' : row.deltaPercent < 0 ? 'text-danger' : 'text-text-dimmed'
                  }`}>
                    {row.deltaPercent !== 0 ? (
                      <>
                        {row.deltaPercent > 0 ? '↑' : '↓'} {Math.abs(row.deltaPercent).toFixed(1)}%
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-dimmed">
                    {formatCurrency(row.arr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
