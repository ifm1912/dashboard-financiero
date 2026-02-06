'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
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
import {
  getInvoices,
  getMRRMetrics,
  formatCurrency,
  formatPercent,
  formatMonth,
  filterInvoicesByDevengo,
  filterInvoicesByCobro,
  filterMRRByDate,
} from '@/lib/data';
import { Invoice, MRRMetric } from '@/types';
import { useDateRange } from '@/contexts';

type Tab = 'overview' | 'customers' | 'breakdown';
type ViewMode = 'devengo' | 'cobros';

interface MonthlyData {
  month: string;
  monthLabel: string;
  devengado: number;
  cobrado: number;
}

interface CustomerData {
  customer_name: string;
  total_facturas: number;
  ingresos_totales: number;
  ingresos_recurrentes: number;
  porcentaje_recurrente: number;
  primera_factura: string;
  ultima_factura: string;
  estado_cliente: 'activo' | 'inactivo';
}

type SortField = keyof CustomerData;
type SortDirection = 'asc' | 'desc';

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

export default function RevenueAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('devengo');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mrrData, setMrrData] = useState<MRRMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('ingresos_totales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { dateRange } = useDateRange();

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, mrrMetrics] = await Promise.all([
          getInvoices(),
          getMRRMetrics(),
        ]);
        setInvoices(invoicesData);
        setMrrData(mrrMetrics);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered data
  const filteredByDevengo = useMemo(() => {
    return filterInvoicesByDevengo(invoices, dateRange);
  }, [invoices, dateRange]);

  const filteredByCobro = useMemo(() => {
    return filterInvoicesByCobro(invoices, dateRange);
  }, [invoices, dateRange]);

  const filteredMRR = useMemo(() => {
    return filterMRRByDate(mrrData, dateRange);
  }, [mrrData, dateRange]);

  // Revenue KPIs
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

  // MRR KPIs
  const mrrKpis = useMemo(() => {
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

  // Recurring percentage
  const recurringPercent = useMemo(() => {
    const totalRevenue = filteredByDevengo.reduce((sum, inv) => sum + inv.amount_net, 0);
    const recurringRevenue = filteredByDevengo
      .filter(inv => inv.is_recurring || inv.revenue_category === 'recurring')
      .reduce((sum, inv) => sum + inv.amount_net, 0);
    return totalRevenue > 0 ? (recurringRevenue / totalRevenue) * 100 : 0;
  }, [filteredByDevengo]);

  // Monthly data
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, { devengado: number; cobrado: number }>();

    filteredByDevengo.forEach(inv => {
      const month = inv.invoice_month_start;
      if (!monthMap.has(month)) {
        monthMap.set(month, { devengado: 0, cobrado: 0 });
      }
      monthMap.get(month)!.devengado += inv.amount_net;
    });

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

  // MRR chart data
  const mrrChartData = useMemo(() => {
    return filteredMRR.map(d => ({
      month: d.month,
      monthLabel: formatMonth(d.month),
      mrr: d.mrr_approx,
      arr: d.arr_approx,
    }));
  }, [filteredMRR]);

  // Customer data
  const customers = useMemo(() => {
    const customerMap = new Map<string, {
      invoices: Invoice[];
      recurring_amount: number;
      total_amount: number;
    }>();

    filteredByDevengo.forEach(inv => {
      const name = inv.customer_name.trim();
      if (!customerMap.has(name)) {
        customerMap.set(name, { invoices: [], recurring_amount: 0, total_amount: 0 });
      }
      const customer = customerMap.get(name)!;
      customer.invoices.push(inv);
      customer.total_amount += inv.amount_net;
      if (inv.is_recurring || inv.revenue_category === 'recurring') {
        customer.recurring_amount += inv.amount_net;
      }
    });

    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const fourMonthsAgoStr = fourMonthsAgo.toISOString().split('T')[0];

    const result: CustomerData[] = [];
    customerMap.forEach((data, name) => {
      const dates = data.invoices.map(inv => inv.invoice_date).sort();
      const primera_factura = dates[0];
      const ultima_factura = dates[dates.length - 1];
      const estado_cliente = ultima_factura >= fourMonthsAgoStr ? 'activo' : 'inactivo';
      const porcentaje_recurrente = data.total_amount > 0
        ? (data.recurring_amount / data.total_amount) * 100
        : 0;

      result.push({
        customer_name: name,
        total_facturas: data.invoices.length,
        ingresos_totales: data.total_amount,
        ingresos_recurrentes: data.recurring_amount,
        porcentaje_recurrente,
        primera_factura,
        ultima_factura,
        estado_cliente,
      });
    });

    return result;
  }, [filteredByDevengo]);

  // Sorted customers
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [customers, sortField, sortDirection]);

  // Customer KPIs
  const customerKpis = useMemo(() => {
    const totalClientes = customers.length;
    const clientesActivos = customers.filter(c => c.estado_cliente === 'activo').length;
    const clientesConRecurrente = customers.filter(c => c.ingresos_recurrentes > 0).length;
    const porcentajeRecurrentes = totalClientes > 0
      ? (clientesConRecurrente / totalClientes) * 100
      : 0;

    const customersExclAIE = customers.filter(c => c.customer_name !== 'AIE');
    const topCliente = customersExclAIE.reduce((top, c) =>
      c.ingresos_totales > (top?.ingresos_totales || 0) ? c : top,
      customersExclAIE[0]
    );

    return {
      totalClientes,
      clientesActivos,
      porcentajeRecurrentes,
      topCliente,
    };
  }, [customers]);

  // Top 10 customers for concentration chart
  const top10Customers = useMemo(() => {
    return [...customers]
      .filter(c => c.customer_name !== 'AIE')
      .sort((a, b) => b.ingresos_totales - a.ingresos_totales)
      .slice(0, 10)
      .map(c => ({
        name: c.customer_name,
        value: c.ingresos_totales,
      }));
  }, [customers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-text-muted ml-1 opacity-50">↕</span>;
    }
    return <span className="text-accent-light ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

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
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'overview'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Revenue Overview
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'customers'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Customer Analysis
          {activeTab === 'customers' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'breakdown'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Revenue Breakdown
          {activeTab === 'breakdown' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Note */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 px-4 py-2.5">
            <p className="text-[11px] text-text-dimmed">
              MRR aproximado basado en fecha de emisión. Solo facturas con revenue_category = recurring.
            </p>
          </div>

          {/* Main KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <KPICard
              label="Total Revenue"
              value={formatCurrency(devengoKpis.totalDevengado)}
              subtitle="Facturación emitida"
            />
            <KPICard
              label="% Recurring"
              value={formatPercent(recurringPercent)}
              subtitle="Del total de ingresos"
            />
            <KPICard
              label="MRR Actual"
              value={formatCurrency(mrrKpis.currentMRR)}
              subtitle="Último mes del período"
            />
            <KPICard
              label="ARR Actual"
              value={formatCurrency(mrrKpis.currentARR)}
              trend={{
                value: mrrKpis.deltaPercent,
                label: 'vs mes anterior'
              }}
            />
          </div>

          {/* Mode Toggle */}
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

          {/* Secondary KPIs based on mode */}
          {viewMode === 'devengo' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KPICard
                label="Total Devengado"
                value={formatCurrency(devengoKpis.totalDevengado)}
                subtitle={`${devengoKpis.numFacturas} facturas`}
              />
              <KPICard
                label="Ticket Medio"
                value={formatCurrency(devengoKpis.ticketMedio)}
                subtitle="Por factura"
              />
              <KPICard
                label="Pendiente de Cobro"
                value={formatCurrency(devengoKpis.importePendiente)}
                subtitle={`${devengoKpis.facturasPendientes} facturas (${formatPercent(devengoKpis.porcentajePendientes)})`}
              />
            </div>
          )}

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

          {/* MRR Evolution Chart */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-text-secondary">Evolución del MRR</h3>
              <p className="mt-0.5 text-xs text-text-dimmed">Monthly Recurring Revenue histórico</p>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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

          {/* Monthly Revenue Chart */}
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
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-8">
          {/* Customer KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <KPICard
              label="Total Clientes"
              value={String(customerKpis.totalClientes)}
            />
            <KPICard
              label="Clientes Activos"
              value={String(customerKpis.clientesActivos)}
              subtitle="Última factura < 4 meses"
            />
            <KPICard
              label="% Con Recurrente"
              value={formatPercent(customerKpis.porcentajeRecurrentes)}
            />
            <KPICard
              label="Top Cliente"
              value={customerKpis.topCliente?.customer_name || '-'}
              subtitle={customerKpis.topCliente ? formatCurrency(customerKpis.topCliente.ingresos_totales) : undefined}
            />
          </div>

          {/* Customer Concentration Chart */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-text-secondary">Top 10 Clientes por Revenue</h3>
              <p className="mt-0.5 text-xs text-text-dimmed">Concentración de ingresos</p>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Customers} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
                  <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Customer Table */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
            <div className="px-5 py-4">
              <h3 className="text-sm font-medium text-text-secondary">Listado de Clientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-t border-border-subtle">
                    <th
                      className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('customer_name')}
                    >
                      Cliente <SortIcon field="customer_name" />
                    </th>
                    <th
                      className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('total_facturas')}
                    >
                      Facturas <SortIcon field="total_facturas" />
                    </th>
                    <th
                      className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('ingresos_totales')}
                    >
                      Ingresos <SortIcon field="ingresos_totales" />
                    </th>
                    <th
                      className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('ingresos_recurrentes')}
                    >
                      Recurrentes <SortIcon field="ingresos_recurrentes" />
                    </th>
                    <th
                      className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('porcentaje_recurrente')}
                    >
                      % Rec <SortIcon field="porcentaje_recurrente" />
                    </th>
                    <th
                      className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('ultima_factura')}
                    >
                      Última Fact. <SortIcon field="ultima_factura" />
                    </th>
                    <th
                      className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                      onClick={() => handleSort('estado_cliente')}
                    >
                      Estado <SortIcon field="estado_cliente" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((customer, index) => (
                    <tr
                      key={customer.customer_name}
                      className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                    >
                      <td className="px-5 py-3 text-sm font-medium text-text-primary">
                        {customer.customer_name}
                      </td>
                      <td className="px-5 py-3 text-sm text-center text-text-secondary">
                        {customer.total_facturas}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                        {formatCurrency(customer.ingresos_totales)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-accent-light">
                        {formatCurrency(customer.ingresos_recurrentes)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1 w-10 rounded-full bg-bg-muted overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${Math.min(100, customer.porcentaje_recurrente)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-dimmed w-10">
                            {formatPercent(customer.porcentaje_recurrente)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-text-muted">
                        {new Date(customer.ultima_factura).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          customer.estado_cliente === 'activo'
                            ? 'bg-success-muted text-success'
                            : 'bg-bg-muted text-text-dimmed'
                        }`}>
                          {customer.estado_cliente === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BREAKDOWN TAB */}
      {activeTab === 'breakdown' && (
        <div className="space-y-8">
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 px-4 py-2.5">
            <p className="text-[11px] text-text-dimmed">
              Desglose detallado de ingresos por categorías y períodos mensuales.
            </p>
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
      )}
    </div>
  );
}
