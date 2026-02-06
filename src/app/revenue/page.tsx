'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { KPICard } from '@/components';
import { getInvoices, formatCurrency, formatPercent, formatMonth, filterInvoicesByDevengo, filterInvoicesByCobro } from '@/lib/data';
import { Invoice } from '@/types';
import { useDateRange } from '@/contexts';

type ViewMode = 'devengo' | 'cobros';

interface MonthlyData {
  month: string;
  monthLabel: string;
  devengado: number;
  cobrado: number;
}

const CHART_COLORS = {
  primary: '#4f46e5',
  primaryMuted: 'rgba(79, 70, 229, 0.08)',
  secondary: '#16a34a',
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

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('devengo');
  const { dateRange } = useDateRange();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInvoices();
        setInvoices(data);
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtrar facturas según el modo de vista y el rango de fechas global
  const filteredByDevengo = useMemo(() => {
    return filterInvoicesByDevengo(invoices, dateRange);
  }, [invoices, dateRange]);

  const filteredByCobro = useMemo(() => {
    return filterInvoicesByCobro(invoices, dateRange);
  }, [invoices, dateRange]);

  const devengoKpis = useMemo(() => {
    const totalDevengado = filteredByDevengo.reduce((sum, inv) => sum + inv.amount_net, 0);
    const numFacturas = filteredByDevengo.length;
    const ticketMedio = numFacturas > 0 ? totalDevengado / numFacturas : 0;
    const facturasPendientes = filteredByDevengo.filter(inv => inv.status !== 'paid').length;
    const porcentajePendientes = numFacturas > 0 ? (facturasPendientes / numFacturas) * 100 : 0;
    const importePendiente = filteredByDevengo
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.amount_net, 0);

    return { totalDevengado, numFacturas, ticketMedio, facturasPendientes, porcentajePendientes, importePendiente };
  }, [filteredByDevengo]);

  const cobrosKpis = useMemo(() => {
    const totalCobrado = filteredByCobro.reduce((sum, inv) => sum + inv.amount_net, 0);
    const numFacturasCobradas = filteredByCobro.length;
    const totalDevengado = filteredByDevengo.reduce((sum, inv) => sum + inv.amount_net, 0);
    const cashGap = totalDevengado - totalCobrado;
    const facturasConPago = filteredByCobro.filter(inv => inv.days_to_pay !== null && inv.days_to_pay !== undefined);
    const diasMediosCobro = facturasConPago.length > 0
      ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
      : 0;

    return { totalCobrado, numFacturasCobradas, cashGap, diasMediosCobro };
  }, [filteredByCobro, filteredByDevengo]);

  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, { devengado: number; cobrado: number }>();

    // Devengado - usar facturas filtradas por invoice_date
    filteredByDevengo.forEach(inv => {
      const month = inv.invoice_month_start;
      if (!monthMap.has(month)) {
        monthMap.set(month, { devengado: 0, cobrado: 0 });
      }
      monthMap.get(month)!.devengado += inv.amount_net;
    });

    // Cobrado - usar facturas filtradas por payment_date
    filteredByCobro.forEach(inv => {
      const month = inv.payment_month_start!;
      if (!monthMap.has(month)) {
        monthMap.set(month, { devengado: 0, cobrado: 0 });
      }
      monthMap.get(month)!.cobrado += inv.amount_net;
    });

    const result: MonthlyData[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        monthLabel: formatMonth(month),
        devengado: data.devengado,
        cobrado: data.cobrado,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return result;
  }, [filteredByDevengo, filteredByCobro]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mode Toggle - inline with page */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-border-subtle bg-bg-surface/50 p-0.5">
          <button
            onClick={() => setViewMode('devengo')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'devengo'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Devengo
          </button>
          <button
            onClick={() => setViewMode('cobros')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'cobros'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Cobros
          </button>
        </div>
        <span className="text-xs text-text-dimmed">
          {viewMode === 'devengo' ? 'Facturación emitida' : 'Facturas cobradas'}
        </span>
      </div>

      {/* KPIs - Devengo */}
      {viewMode === 'devengo' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KPICard
            label="Total Devengado"
            value={formatCurrency(devengoKpis.totalDevengado)}
            subtitle="Facturación emitida"
          />
          <KPICard
            label="Ticket Medio"
            value={formatCurrency(devengoKpis.ticketMedio)}
            subtitle={`${devengoKpis.numFacturas} facturas`}
          />
          <KPICard
            label="Pendiente de Cobro"
            value={formatCurrency(devengoKpis.importePendiente)}
            subtitle={`${devengoKpis.facturasPendientes} facturas (${formatPercent(devengoKpis.porcentajePendientes)})`}
          />
        </div>
      )}

      {/* KPIs - Cobros */}
      {viewMode === 'cobros' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KPICard
            label="Total Cobrado"
            value={formatCurrency(cobrosKpis.totalCobrado)}
            subtitle={`${cobrosKpis.numFacturasCobradas} facturas cobradas`}
          />
          <KPICard
            label="Cash Gap"
            value={formatCurrency(cobrosKpis.cashGap)}
            subtitle="Facturado - Cobrado"
          />
          <KPICard
            label="DSO"
            value={`${Math.round(cobrosKpis.diasMediosCobro)} días`}
            subtitle="Days Sales Outstanding"
          />
        </div>
      )}

      {/* Main Chart */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary">
            {viewMode === 'devengo' ? 'Facturación Mensual' : 'Cobros Mensuales'}
          </h3>
          <p className="mt-0.5 text-xs text-text-dimmed">
            {viewMode === 'devengo'
              ? 'Importe neto facturado por mes'
              : 'Importe neto cobrado por mes'
            }
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
              {viewMode === 'devengo' ? (
                <Bar dataKey="devengado" name="Devengado" fill={CHART_COLORS.primary} radius={[2, 2, 0, 0]} />
              ) : (
                <Bar dataKey="cobrado" name="Cobrado" fill={CHART_COLORS.secondary} radius={[2, 2, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary">Comparativa Devengo vs Cobros</h3>
          <p className="mt-0.5 text-xs text-text-dimmed">Evolución mensual del cash gap</p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
              <Legend
                wrapperStyle={{ paddingTop: '16px' }}
                formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
                iconSize={8}
              />
              <Bar dataKey="devengado" name="Devengado" fill={CHART_COLORS.primary} radius={[2, 2, 0, 0]} opacity={0.8} />
              <Line
                type="monotone"
                dataKey="cobrado"
                name="Cobrado"
                stroke={CHART_COLORS.secondary}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: CHART_COLORS.secondary, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary">Resumen por Mes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border-subtle">
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Mes</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Devengado</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Cobrado</th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.slice(-12).map((row, index) => {
                const diff = row.devengado - row.cobrado;
                return (
                  <tr
                    key={row.month}
                    className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                  >
                    <td className="px-5 py-3 text-sm text-text-primary">{row.monthLabel}</td>
                    <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                      {formatCurrency(row.devengado)}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-mono text-success">
                      {formatCurrency(row.cobrado)}
                    </td>
                    <td className={`px-5 py-3 text-sm text-right font-mono ${diff > 0 ? 'text-warning' : 'text-success'}`}>
                      {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
