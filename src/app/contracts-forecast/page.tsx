'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  KPICard,
  ChartContainer,
  ARRByClientChart,
  ARRByProductChart,
  ExpansionByClientChart,
  EventImpactChart,
  ARRByOwnerChart,
} from '@/components';
import {
  getInvoices,
  getContracts,
  getContractEvents,
  formatCurrency,
  formatPercent,
} from '@/lib/data';
import { calculateForecast } from '@/lib/forecast';
import { Invoice, Contract, ContractEvent, ForecastData } from '@/types';
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

type Tab = 'portfolio' | 'expansion' | 'forecast' | 'owners';

const CHART_COLORS = {
  primary: '#4f46e5',
  secondary: '#16a34a',
  tertiary: '#d97706',
  quaternary: '#7c3aed',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

const HORIZON_COLORS = ['#4f46e5', '#7c3aed', '#9333ea', '#a855f7'];

export default function ContractsForecastPage() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, contractsData, eventsData] = await Promise.all([
          getInvoices(),
          getContracts(),
          getContractEvents(),
        ]);
        setInvoices(invoicesData);
        setContracts(contractsData);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Contract KPIs
  const contractKpis = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === 'activo');
    const negotiationContracts = contracts.filter(c => c.status === 'negociación');

    const arrBase = activeContracts.reduce((sum, c) => sum + c.base_arr_eur, 0);
    const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const expansion = arrActual - arrBase;
    const churnFromEvents = events
      .filter(e => e.event_type === 'CANCELACIÓN')
      .reduce((sum, e) => sum + Math.abs(e.arr_delta), 0);
    const pipeline = negotiationContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const activeCount = activeContracts.length;
    const uniqueClients = new Set(activeContracts.map(c => c.client_id)).size;

    return {
      arrBase,
      arrActual,
      expansion,
      churnFromEvents,
      pipeline,
      activeCount,
      uniqueClients,
      negotiationCount: negotiationContracts.length,
    };
  }, [contracts, events]);

  // Upcoming renewals (90 days)
  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    const in90Days = new Date();
    in90Days.setDate(today.getDate() + 90);

    return contracts
      .filter(c => {
        if (c.status !== 'activo' || !c.end_date) return false;
        const endDate = new Date(c.end_date);
        return endDate >= today && endDate <= in90Days;
      })
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
  }, [contracts]);

  // Recent events
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())
      .slice(0, 5);
  }, [events]);

  // Forecast data
  const forecast: ForecastData | null = useMemo(() => {
    if (invoices.length === 0 || contracts.length === 0) return null;
    return calculateForecast(contracts, invoices);
  }, [invoices, contracts]);

  // Horizon chart data
  const horizonChartData = useMemo(() => {
    if (!forecast) return [];
    return [
      { name: 'M+1', value: forecast.forecastM1 },
      { name: 'M+3', value: forecast.forecastM3 },
      { name: 'M+6', value: forecast.forecastM6 },
      { name: 'M+12', value: forecast.forecastM12 },
    ];
  }, [forecast]);

  // FY chart data
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

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'portfolio'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Contract Portfolio
          {activeTab === 'portfolio' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('expansion')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'expansion'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Expansion & Churn
          {activeTab === 'expansion' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'forecast'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Revenue Forecast
          {activeTab === 'forecast' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('owners')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'owners'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Portfolio by Owner
          {activeTab === 'owners' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {/* PORTFOLIO TAB */}
      {activeTab === 'portfolio' && (
        <div className="space-y-8">
          {/* Main KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KPICard
              label="ARR Contractual Base"
              value={formatCurrency(contractKpis.arrBase)}
              subtitle="Sin IPC ni expansiones"
            />
            <KPICard
              label="ARR Contractual Actual"
              value={formatCurrency(contractKpis.arrActual)}
              subtitle="Base + IPC + Expansiones"
            />
            <KPICard
              label="Expansión Contractual"
              value={formatCurrency(contractKpis.expansion)}
              subtitle={`${((contractKpis.expansion / contractKpis.arrBase) * 100).toFixed(1)}% sobre base`}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Contratos Recurrentes</p>
              <p className="mt-1.5 text-xl font-semibold text-text-primary">{contractKpis.activeCount}</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Clientes Recurrentes</p>
              <p className="mt-1.5 text-xl font-semibold text-text-primary">{contractKpis.uniqueClients}</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Churn</p>
              <p className="mt-1.5 text-xl font-semibold text-danger">{formatCurrency(contractKpis.churnFromEvents)}</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Pipeline</p>
              <p className="mt-1.5 text-xl font-semibold text-warning">{formatCurrency(contractKpis.pipeline)}</p>
              <p className="text-[10px] text-text-dimmed">{contractKpis.negotiationCount} en negociación</p>
            </div>
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartContainer
              title="ARR por Cliente"
              subtitle="Top 10 clientes por ARR contractual"
            >
              <ARRByClientChart contracts={contracts} />
            </ChartContainer>

            <ChartContainer
              title="ARR por Producto"
              subtitle="Distribución del ARR contractual"
            >
              <ARRByProductChart contracts={contracts} />
            </ChartContainer>
          </div>

          {/* Upcoming Renewals */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Renovaciones Próximas (90 días)</h3>
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-text-muted">Sin renovaciones próximas</p>
            ) : (
              <div className="space-y-2">
                {upcomingRenewals.map(c => (
                  <div
                    key={c.contract_id}
                    className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{c.client_name}</p>
                      <p className="text-xs text-text-dimmed">{c.product}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">{formatCurrency(c.current_price_annual)}</p>
                      <p className="text-xs text-warning">
                        {new Date(c.end_date!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPANSION & CHURN TAB */}
      {activeTab === 'expansion' && (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KPICard
              label="Total Expansión"
              value={formatCurrency(contractKpis.expansion)}
              subtitle={`${((contractKpis.expansion / contractKpis.arrBase) * 100).toFixed(1)}% del ARR base`}
            />
            <KPICard
              label="Churn Contractual"
              value={formatCurrency(contractKpis.churnFromEvents)}
              subtitle="Cancelaciones registradas"
            />
            <KPICard
              label="Net Expansion"
              value={formatCurrency(contractKpis.expansion - contractKpis.churnFromEvents)}
              subtitle="Expansión - Churn"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Expansión por Cliente"
              subtitle="Clientes con mayor crecimiento contractual"
            >
              <ExpansionByClientChart contracts={contracts} />
            </ChartContainer>

            <ChartContainer
              title="Expansión vs Cancelación"
              subtitle="Impacto de eventos contractuales"
            >
              <EventImpactChart events={events} />
            </ChartContainer>
          </div>

          {/* Recent Events */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Eventos Recientes</h3>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-text-muted">Sin eventos registrados</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(e => (
                  <div
                    key={e.event_id}
                    className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{e.client_name}</p>
                      <p className="text-xs text-text-dimmed">{e.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${e.arr_delta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {e.arr_delta >= 0 ? '+' : ''}{formatCurrency(e.arr_delta)}
                      </p>
                      <p className="text-xs text-text-dimmed">
                        {new Date(e.effective_from).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FORECAST TAB */}
      {activeTab === 'forecast' && (
        <div className="space-y-8">
          {forecast ? (
            <>
              {/* Note */}
              <div className="rounded-lg border border-border-subtle bg-bg-surface/30 px-4 py-2.5">
                <p className="text-[11px] text-text-dimmed">
                  Estimación operativa basada en último consumo real. No incluye IPC, expansiones futuras ni nuevos clientes.
                </p>
              </div>

              {/* Forecast KPIs */}
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

              {/* Charts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Horizon Chart */}
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

                {/* FY Chart */}
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

              {/* Client Detail Table */}
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
            </>
          ) : (
            <div className="flex h-[40vh] items-center justify-center text-text-muted">
              No hay datos disponibles para el forecast
            </div>
          )}
        </div>
      )}

      {/* OWNERS TAB */}
      {activeTab === 'owners' && (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KPICard
              label="Total ARR"
              value={formatCurrency(contractKpis.arrActual)}
              subtitle="Distribuido entre account owners"
            />
            <KPICard
              label="Contratos Activos"
              value={String(contractKpis.activeCount)}
              subtitle="En total"
            />
            <KPICard
              label="Clientes Únicos"
              value={String(contractKpis.uniqueClients)}
              subtitle="Con contratos activos"
            />
          </div>

          {/* Portfolio by Owner Chart */}
          <ChartContainer
            title="Portfolio por Account Owner"
            subtitle="ARR contractual por responsable"
          >
            <ARRByOwnerChart contracts={contracts} />
          </ChartContainer>

          {/* Note */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 px-4 py-2.5">
            <p className="text-[11px] text-text-dimmed">
              Esta vista muestra la distribución del ARR contractual por account owner para gestión de portfolio comercial.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
