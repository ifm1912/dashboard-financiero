'use client';

import { useEffect, useState, useMemo } from 'react';
import { KPICard, ChartContainer } from '@/components';
import { getPayrollData, getExpenses, formatCurrency } from '@/lib/data';
import { PayrollData, PayrollMonth } from '@/lib/data';
import { Expense } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CHART_COLORS = {
  gross: '#4f46e5',
  ss_employer: '#7c3aed',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${MONTH_NAMES[month] || month} ${year?.slice(-2)}`;
}

export default function RRHHPage() {
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPayrollData(), getExpenses()])
      .then(([p, e]) => {
        setPayroll(p);
        setExpenses(e);
        if (p && p.months.length > 0) {
          const firstMonth = p.months[0].month;
          setSelectedMonth(firstMonth);
          setSelectedYear(firstMonth.split('-')[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Available years (most recent first)
  const availableYears = useMemo(() => {
    if (!payroll) return [];
    const years = [...new Set(payroll.months.map(m => m.month.split('-')[0]))];
    return years.sort().reverse();
  }, [payroll]);

  // Months filtered by selected year (most recent first for dropdown)
  const yearMonths = useMemo(() => {
    if (!payroll || !selectedYear) return [];
    return payroll.months
      .filter(m => m.month.startsWith(selectedYear))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [payroll, selectedYear]);

  // Auto-select month when year changes
  useEffect(() => {
    if (yearMonths.length > 0 && !yearMonths.find(m => m.month === selectedMonth)) {
      setSelectedMonth(yearMonths[0].month);
    }
  }, [selectedYear, yearMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentMonth: PayrollMonth | null = useMemo(() => {
    if (!payroll || !selectedMonth) return null;
    return payroll.months.find(m => m.month === selectedMonth) || null;
  }, [payroll, selectedMonth]);

  // Year-over-year comparison: same month, previous year
  const previousYearMonth: PayrollMonth | null = useMemo(() => {
    if (!payroll || !selectedMonth) return null;
    const [y, m] = selectedMonth.split('-');
    const prevKey = `${parseInt(y) - 1}-${m}`;
    return payroll.months.find(mo => mo.month === prevKey) || null;
  }, [payroll, selectedMonth]);

  // Calculate % of burn rate (total salary cost / total operational expenses)
  const burnPct = useMemo(() => {
    if (!currentMonth || expenses.length === 0) return 0;
    const monthExpenses = expenses.filter(
      e => e.expense_date.startsWith(currentMonth.month) && e.category !== 'Financiación'
    );
    const totalExpenses = Math.abs(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
    return totalExpenses > 0 ? (currentMonth.total_cost / totalExpenses) * 100 : 0;
  }, [currentMonth, expenses]);

  // Chart data: filtered by selected year
  const chartData = useMemo(() => {
    if (!payroll || !selectedYear) return [];
    return [...payroll.months]
      .filter(m => m.month.startsWith(selectedYear))
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: formatMonth(m.month),
        monthKey: m.month,
        'Salario bruto': m.total_gross,
        'SS Empresa': m.total_employer_ss,
        'Coste total': m.total_cost,
        headcount: m.headcount,
      }));
  }, [payroll, selectedYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!payroll || payroll.months.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-text-primary mb-4">RRHH / Personal</h1>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center">
          <p className="text-text-muted">No hay datos de nóminas disponibles.</p>
          <p className="text-sm text-text-dimmed mt-2">
            Ejecuta <code className="text-xs bg-bg-elevated px-1.5 py-0.5 rounded">python procesar_nominas.py</code> para generar los datos.
          </p>
        </div>
      </div>
    );
  }

  const avgCostPerEmployee = currentMonth
    ? currentMonth.total_cost / currentMonth.headcount
    : 0;

  // Trend helpers
  const costTrend = previousYearMonth && currentMonth
    ? {
        value: ((currentMonth.total_cost - previousYearMonth.total_cost) / previousYearMonth.total_cost) * 100,
        label: `vs ${formatMonth(previousYearMonth.month)}`,
      }
    : undefined;

  const headcountTrend = previousYearMonth && currentMonth
    ? {
        value: ((currentMonth.headcount - previousYearMonth.headcount) / previousYearMonth.headcount) * 100,
        label: `vs ${formatMonth(previousYearMonth.month)}`,
      }
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl font-semibold text-text-primary">RRHH / Personal</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Mes:</span>
            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {yearMonths.map(m => (
                <option key={m.month} value={m.month}>
                  {formatMonth(m.month)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Year tabs */}
        {availableYears.length > 1 && (
          <div className="flex items-center gap-1 sm:gap-2 border-b border-border-subtle overflow-x-auto">
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                  selectedYear === year
                    ? 'text-accent'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {year}
                {selectedYear === year && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <KPICard
          label="Headcount"
          value={currentMonth?.headcount.toString() || '0'}
          subtitle="empleados"
          trend={headcountTrend}
        />
        <KPICard
          label="Coste Total"
          value={formatCurrency(currentMonth?.total_cost || 0)}
          subtitle="coste empresa mensual"
          trend={costTrend}
        />
        <KPICard
          label="Coste Medio"
          value={formatCurrency(avgCostPerEmployee)}
          subtitle="por empleado"
        />
        <KPICard
          label="% Burn Rate"
          value={`${burnPct.toFixed(1)}%`}
          subtitle="del gasto operativo"
        />
      </div>

      {/* Chart: Monthly evolution (filtered by year) */}
      {chartData.length > 0 && (
        <ChartContainer title="Coste de Personal Mensual" subtitle={`Datos de ${selectedYear}`}>
          <div className="h-56 sm:h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="Salario bruto"
                  stackId="a"
                  fill={CHART_COLORS.gross}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="SS Empresa"
                  stackId="a"
                  fill={CHART_COLORS.ss_employer}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      )}

      {/* Summary cards */}
      {currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-xs text-text-muted mb-1">Total Bruto</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCurrency(currentMonth.total_gross)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-xs text-text-muted mb-1">Total Retenciones</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCurrency(currentMonth.total_deductions)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-xs text-text-muted mb-1">SS Empresa</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCurrency(currentMonth.total_employer_ss)}
            </p>
          </div>
        </div>
      )}

      {/* Employee table */}
      {currentMonth && (
        <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h3 className="text-sm font-medium text-text-primary">
              Desglose por Empleado - {formatMonth(currentMonth.month)}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-muted uppercase tracking-wider">Empleado</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">Bruto</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">IRPF</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">SS Empl.</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">Neto</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">SS Empresa</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-muted uppercase tracking-wider">Coste Total</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-medium text-text-muted uppercase tracking-wider w-14">PDF</th>
                </tr>
              </thead>
              <tbody>
                {currentMonth.employees.map((emp) => (
                  <tr key={emp.code} className="border-b border-border-subtle/50 hover:bg-bg-elevated/30">
                    <td className="px-4 py-2.5 text-sm font-medium text-text-primary">
                      <span className="font-mono text-xs text-text-dimmed mr-2">#{emp.code}</span>
                      {emp.initials}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-text-secondary font-mono">
                      {formatCurrency(emp.gross)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-danger/80 font-mono">
                      {formatCurrency(emp.irpf)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-danger/60 font-mono">
                      {formatCurrency(emp.ss_employee)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-success font-mono">
                      {formatCurrency(emp.net)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-text-muted font-mono">
                      {formatCurrency(emp.ss_employer)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-text-primary font-semibold font-mono">
                      {formatCurrency(emp.total_cost)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {emp.pdf_available ? (
                        <a
                          href={`/data/nominas/${selectedMonth}/${String(emp.code).padStart(3, '0')}.pdf`}
                          download={`nomina_${selectedMonth}_${emp.code}.pdf`}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent transition-colors"
                          title={`Descargar nómina ${emp.initials}`}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </a>
                      ) : (
                        <span className="inline-flex items-center justify-center p-1.5 text-text-dimmed/30">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-bg-elevated/50">
                  <td className="px-4 py-2.5 text-sm font-semibold text-text-primary">Total</td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-text-primary font-mono">
                    {formatCurrency(currentMonth.total_gross)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-danger/80 font-mono">
                    {formatCurrency(currentMonth.employees.reduce((s, e) => s + e.irpf, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-danger/60 font-mono">
                    {formatCurrency(currentMonth.employees.reduce((s, e) => s + e.ss_employee, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-success font-mono">
                    {formatCurrency(currentMonth.total_net)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-text-muted font-mono">
                    {formatCurrency(currentMonth.total_employer_ss)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold text-text-primary font-mono">
                    {formatCurrency(currentMonth.total_cost)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
