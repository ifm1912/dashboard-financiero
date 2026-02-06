'use client';

import { useEffect, useState, useMemo } from 'react';
import { KPICard, ChartContainer } from '@/components';
import { getInvoices, getContracts, formatCurrency, formatPercent } from '@/lib/data';
import { calculateForecast } from '@/lib/forecast';
import { Invoice, Contract, ForecastData } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Colores del design system (Light Mode)
const CHART_COLORS = {
  primary: '#4f46e5',
  secondary: '#16a34a',
  tertiary: '#d97706',
  quaternary: '#7c3aed',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

const HORIZON_COLORS = ['#4f46e5', '#7c3aed', '#9333ea', '#a855f7'];

export default function ForecastPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, contractsData] = await Promise.all([
          getInvoices(),
          getContracts(),
        ]);
        setInvoices(invoicesData);
        setContracts(contractsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calcular forecast
  const forecast: ForecastData | null = useMemo(() => {
    if (invoices.length === 0 || contracts.length === 0) return null;
    return calculateForecast(contracts, invoices);
  }, [invoices, contracts]);

  // Datos para el gráfico de horizontes
  const horizonChartData = useMemo(() => {
    if (!forecast) return [];
    return [
      { name: 'M+1', value: forecast.forecastM1 },
      { name: 'M+3', value: forecast.forecastM3 },
      { name: 'M+6', value: forecast.forecastM6 },
      { name: 'M+12', value: forecast.forecastM12 },
    ];
  }, [forecast]);

  // Datos para el gráfico FY
  const fyChartData = useMemo(() => {
    if (!forecast) return [];
    return [
      { name: 'Facturado YTD', value: forecast.facturadoYTD, color: CHART_COLORS.secondary },
      { name: 'Forecast Restante', value: forecast.forecastRestanteFY, color: CHART_COLORS.primary },
    ];
  }, [forecast]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-text-muted">
        No hay datos disponibles para el forecast
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Forecast</h1>
        <p className="text-sm text-text-muted">
          Estimación operativa basada en último consumo real
        </p>
      </div>

      {/* KPIs principales - Horizontes + FY */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <KPICard
          label="Forecast M+1"
          value={formatCurrency(forecast.forecastM1)}
          subtitle="Próximo mes"
        />
        <KPICard
          label="Forecast M+3"
          value={formatCurrency(forecast.forecastM3)}
          subtitle="Próximos 3 meses"
        />
        <KPICard
          label="Forecast M+6"
          value={formatCurrency(forecast.forecastM6)}
          subtitle="Próximos 6 meses"
        />
        <KPICard
          label="Forecast M+12"
          value={formatCurrency(forecast.forecastM12)}
          subtitle="Run-rate anual"
        />
        <KPICard
          label={`FY${forecast.fiscalYear}`}
          value={formatCurrency(forecast.totalEstimadoFY)}
          subtitle={`${forecast.mesesRestantesFY} meses restantes`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de horizontes */}
        <ChartContainer
          title="Forecast por Horizonte"
          subtitle="Proyección acumulada"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horizonChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={CHART_COLORS.text}
                  fontSize={11}
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
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" name="Forecast" radius={[4, 4, 0, 0]}>
                  {horizonChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={HORIZON_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Vista FY */}
        <ChartContainer
          title={`Vista FY${forecast.fiscalYear}`}
          subtitle="Facturado vs Forecast"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fyChartData}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 100, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={CHART_COLORS.text}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={CHART_COLORS.text}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={95}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {fyChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: CHART_COLORS.secondary }} />
              <span className="text-text-muted">Facturado YTD: {formatCurrency(forecast.facturadoYTD)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: CHART_COLORS.primary }} />
              <span className="text-text-muted">Forecast: {formatCurrency(forecast.forecastRestanteFY)}</span>
            </div>
          </div>
        </ChartContainer>
      </div>

      {/* Tabla de detalle por cliente */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary">Detalle por Cliente</h3>
          <p className="text-xs text-text-dimmed mt-1">
            MRR estimado basado en última factura o contrato
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border-subtle">
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Frecuencia
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Últ. Factura
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Importe Fact.
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  MRR Est.
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  % Total
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  FY{forecast.fiscalYear}
                </th>
              </tr>
            </thead>
            <tbody>
              {forecast.clients.map((client, index) => (
                <tr
                  key={client.clientId}
                  className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                >
                  <td className="px-5 py-3 text-sm text-text-primary font-medium">
                    {client.clientName}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-muted">
                    {client.contractName}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      client.billingFrequency === 'trimestral'
                        ? 'bg-tertiary/10 text-tertiary'
                        : client.billingFrequency === 'anual'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-text-dimmed/10 text-text-muted'
                    }`}>
                      {client.billingFrequency}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-muted">
                    {client.lastInvoiceDate
                      ? new Date(client.lastInvoiceDate).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })
                      : <span className="text-text-dimmed italic">Sin factura</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                    {formatCurrency(client.lastInvoiceAmount)}
                    {client.source === 'contrato' && (
                      <span className="ml-1 text-[10px] text-text-dimmed">(c)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-primary font-medium">
                    {formatCurrency(client.mrrEstimado)}
                  </td>
                  <td className="px-5 py-3 text-sm text-right text-text-muted">
                    {formatPercent(client.percentOfTotal)}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-accent-light">
                    {formatCurrency(client.forecastFY)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-default bg-bg-surface/50">
                <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-text-primary">
                  Total
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono font-semibold text-text-primary">
                  {formatCurrency(forecast.totalMRR)}
                </td>
                <td className="px-5 py-3 text-sm text-right text-text-muted">
                  100%
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono font-semibold text-accent-light">
                  {formatCurrency(forecast.forecastRestanteFY)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-text-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xs text-text-dimmed leading-relaxed">
            <p className="font-medium text-text-muted mb-1">Sobre este forecast</p>
            <p>
              Este forecast estima los ingresos futuros en base a clientes recurrentes activos
              y el último importe neto facturado a cada uno. Asume consumo estable y facturación mensual.
              No incluye IPC, expansiones futuras, nuevos clientes ni variaciones de consumo.
              Es una estimación operativa para planificación, no una previsión contable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
