'use client';

import { useEffect, useState, useMemo } from 'react';
import { KPICard, ChartContainer, CategoryDetailPanel, BurnAnalysisCard } from '@/components';
import { getInvoices, getExpenses, getCashBalance, getInflows, formatCurrency } from '@/lib/data';
import {
  calculateCashflowMetrics,
  getCashHistory,
  generateCashflowChartData,
  getExpensesByCategoryFiltered,
} from '@/lib/cashflow';
import { Invoice, Expense, CashBalance, CashflowMetrics, CashProjectionPoint, CashflowChartPoint, BankInflow, ExpenseCategory } from '@/types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
} from 'recharts';

// Colores del design system
const CHART_COLORS = {
  primary: '#4f46e5',
  secondary: '#16a34a',
  tertiary: '#d97706',
  danger: '#dc2626',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Salarios': '#4f46e5',
  'Outsourcing': '#7c3aed',
  'Profesionales': '#2563eb',
  'Marketing': '#d97706',
  'Operaciones': '#64748b',
  'Impuestos': '#dc2626',
  'Financiación': '#6b7280',
};

// Opciones para el selector de histórico
const HISTORY_OPTIONS = [
  { value: 0, label: 'Todo' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
];

export default function CashflowPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inflows, setInflows] = useState<BankInflow[]>([]);
  const [cashBalance, setCashBalance] = useState<CashBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalMonths, setHistoricalMonths] = useState<number>(12); // Default: 12 meses
  const [expensesPeriodMonths, setExpensesPeriodMonths] = useState<number>(12); // Default: 12 meses para distribución
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, expensesData, inflowsData, cashBalanceData] = await Promise.all([
          getInvoices(),
          getExpenses(),
          getInflows(),
          getCashBalance(),
        ]);
        setInvoices(invoicesData);
        setExpenses(expensesData);
        setInflows(inflowsData);
        setCashBalance(cashBalanceData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calcular métricas de cashflow usando inflows bancarios reales
  const metrics: CashflowMetrics | null = useMemo(() => {
    if (expenses.length === 0 || !cashBalance) return null;
    return calculateCashflowMetrics(expenses, inflows, cashBalance, 6);
  }, [expenses, inflows, cashBalance]);

  // Datos para gráfico de evolución de caja (solo histórico, sin proyección)
  const cashHistoryData: CashProjectionPoint[] = useMemo(() => {
    if (!cashBalance) return [];
    return getCashHistory(cashBalance.history, historicalMonths);
  }, [cashBalance, historicalMonths]);

  // Datos para gráfico inflows vs outflows (usa movimientos bancarios reales)
  const cashflowChartData: CashflowChartPoint[] = useMemo(() => {
    if (expenses.length === 0 || inflows.length === 0) return [];
    return generateCashflowChartData(expenses, inflows, 12);
  }, [expenses, inflows]);

  // Total gastos operativos (para el panel de detalle)
  const totalOperational = useMemo(() => {
    if (!metrics) return 0;
    return metrics.expensesByCategory
      .filter(e => e.category !== 'Financiación')
      .reduce((sum, e) => sum + e.total, 0);
  }, [metrics]);

  // Datos para gráfico de distribución de gastos (filtrados por período)
  const expensesByPeriod = useMemo(() => {
    if (expenses.length === 0) return [];
    return getExpensesByCategoryFiltered(expenses, expensesPeriodMonths);
  }, [expenses, expensesPeriodMonths]);

  // Formatear runway
  const formatRunway = (months: number): string => {
    if (months < 0) return '∞';
    if (months > 120) return '+10 años';
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = Math.round(months % 12);
      return remainingMonths > 0 ? `${years}a ${remainingMonths}m` : `${years} años`;
    }
    return `${Math.round(months)} meses`;
  };

  // Formatear fecha runway
  const formatRunwayDate = (dateStr: string): string => {
    if (dateStr === 'Indefinido') return dateStr;
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!metrics || !cashBalance) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-text-muted">
        No hay datos disponibles para el cashflow
      </div>
    );
  }

  // Variables para indicadores visuales (no usadas en KPICard pero útiles para futuro)
  // const isHealthy = metrics.netBurn <= 0 || metrics.runwayMonths > 12;
  // const isWarning = metrics.runwayMonths > 6 && metrics.runwayMonths <= 12;
  // const isDanger = metrics.runwayMonths > 0 && metrics.runwayMonths <= 6;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Cash Flow</h1>
        <p className="text-sm text-text-muted">
          Análisis de runway, burn rate y proyección de caja
        </p>
      </div>

      {/* KPIs principales - 2 columnas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Columna izquierda: Stack vertical de KPIs */}
        <div className="flex flex-col gap-4">
          <KPICard
            label="Caja Actual"
            value={formatCurrency(metrics.currentCash)}
            subtitle={`Actualizado ${new Date(metrics.lastUpdated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
          />
          <KPICard
            label="Runway"
            value={formatRunway(metrics.runwayMonths)}
            subtitle={metrics.runwayMonths < 0
              ? 'Cash flow positivo'
              : `Hasta ${formatRunwayDate(metrics.runwayEndDate)}`}
          />
        </div>

        {/* Columna derecha: Análisis de Burn */}
        <BurnAnalysisCard
          burnRate={metrics.burnRate}
          avgMonthlyInflow={metrics.avgMonthlyInflow}
          netBurn={metrics.netBurn}
          period={metrics.burnRatePeriod}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Evolución de caja (solo histórico) */}
        <div className="rounded-lg border border-border-subtle bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Evolución de Caja</h3>
              <p className="text-xs text-text-muted">Saldo bancario histórico</p>
            </div>
            <select
              value={historicalMonths}
              onChange={(e) => setHistoricalMonths(Number(e.target.value))}
              className="text-xs border border-border-subtle rounded px-2 py-1 bg-bg-surface text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {HISTORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashHistoryData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
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
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Saldo']}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine y={0} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="projected"
                  name="Saldo"
                  stroke={CHART_COLORS.secondary}
                  strokeWidth={2}
                  fill="url(#cashGradient)"
                  dot={{ fill: CHART_COLORS.secondary, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inflows vs Outflows */}
        <ChartContainer
          title="Inflows vs Outflows"
          subtitle="Comparativa mensual"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="inflow" name="Cobros" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name="Gastos" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Breakdown por categoría */}
      <div className="rounded-lg border border-border-subtle bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Distribución de Gastos</h3>
            <p className="text-xs text-text-muted">Click en una categoría para ver detalles</p>
          </div>
          <select
            value={expensesPeriodMonths}
            onChange={(e) => setExpensesPeriodMonths(Number(e.target.value))}
            className="text-xs border border-border-subtle rounded px-2 py-1 bg-bg-surface text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {HISTORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={expensesByPeriod}
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
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`}
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke={CHART_COLORS.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={95}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), 'Total']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="total"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data) => {
                  const category = (data as { category?: string })?.category;
                  if (category) {
                    setSelectedCategory(category as ExpenseCategory);
                  }
                }}
              >
                {expensesByPeriod.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || CHART_COLORS.text} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {expensesByPeriod.map((entry) => (
            <div key={entry.category} className="flex items-center gap-2 text-xs">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: CATEGORY_COLORS[entry.category] || CHART_COLORS.text }}
              />
              <span className="text-text-muted">
                {entry.category}: {entry.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
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
            <p className="font-medium text-text-muted mb-1">Sobre este análisis</p>
            <p>
              Todos los datos provienen de movimientos bancarios reales. El burn rate es el promedio
              de gastos operativos de los últimos 6 meses, excluyendo financiación (préstamos, seed).
              Los ingresos promedio se calculan de inflows bancarios operativos. El runway asume
              que el net burn se mantiene constante. Estimación para planificación, no proyección formal.
            </p>
          </div>
        </div>
      </div>

      {/* Panel de detalle por categoría */}
      {selectedCategory && (
        <CategoryDetailPanel
          category={selectedCategory}
          expenses={expenses}
          totalOperational={totalOperational}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
