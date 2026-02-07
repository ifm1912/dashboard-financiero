'use client';

import { useMemo } from 'react';
import { Expense, ExpenseCategory } from '@/types';
import { formatCurrency } from '@/lib/data';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CategoryDetailPanelProps {
  category: ExpenseCategory;
  expenses: Expense[];
  totalOperational: number;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Salarios': '#4f46e5',
  'Outsourcing': '#7c3aed',
  'Profesionales': '#2563eb',
  'Marketing': '#d97706',
  'Operaciones': '#64748b',
  'Impuestos': '#dc2626',
};

export function CategoryDetailPanel({
  category,
  expenses,
  totalOperational,
  onClose,
}: CategoryDetailPanelProps) {
  // Filtrar gastos de esta categoría
  const categoryExpenses = useMemo(() => {
    return expenses.filter(e => e.category === category);
  }, [expenses, category]);

  // Total de la categoría
  const categoryTotal = useMemo(() => {
    return Math.abs(categoryExpenses.reduce((sum, e) => sum + e.amount, 0));
  }, [categoryExpenses]);

  // Porcentaje del total operativo
  const percentage = totalOperational > 0
    ? (categoryTotal / totalOperational) * 100
    : 0;

  // Desglose por subcategoría
  const subcategoryBreakdown = useMemo(() => {
    const bySubcategory = new Map<string, number>();

    categoryExpenses.forEach(expense => {
      const sub = expense.subcategory || 'Sin categorizar';
      const current = bySubcategory.get(sub) || 0;
      bySubcategory.set(sub, current + Math.abs(expense.amount));
    });

    return Array.from(bySubcategory.entries())
      .map(([name, total]) => ({
        name,
        total,
        percentage: categoryTotal > 0 ? (total / categoryTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [categoryExpenses, categoryTotal]);

  // Evolución mensual (últimos 6 meses)
  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();

    categoryExpenses.forEach(expense => {
      const month = expense.expense_date.substring(0, 7);
      const current = byMonth.get(month) || 0;
      byMonth.set(month, current + Math.abs(expense.amount));
    });

    const allMonths = Array.from(byMonth.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Últimos 6 meses
    return allMonths.slice(-6).map(item => ({
      ...item,
      monthLabel: formatMonthLabel(item.month),
    }));
  }, [categoryExpenses]);

  // Top 5 gastos individuales
  const topExpenses = useMemo(() => {
    return [...categoryExpenses]
      .sort((a, b) => a.amount - b.amount) // más negativo primero
      .slice(0, 5)
      .map(e => ({
        description: e.description.slice(0, 40) + (e.description.length > 40 ? '...' : ''),
        amount: Math.abs(e.amount),
        date: e.expense_date,
      }));
  }, [categoryExpenses]);

  const color = CATEGORY_COLORS[category] || '#64748b';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-full sm:max-w-md bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border-subtle p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-lg font-semibold text-text-primary">{category}</h2>
              </div>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {formatCurrency(categoryTotal)}
              </p>
              <p className="text-sm text-text-muted">
                {percentage.toFixed(1)}% del total operativo
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-surface rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Evolución mensual */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Evolución mensual
            </h3>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="monthLabel"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), 'Total']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Desglose por subcategoría */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Desglose por subcategoría
            </h3>
            <div className="space-y-2">
              {subcategoryBreakdown.map((sub) => (
                <div key={sub.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted truncate flex-1">{sub.name}</span>
                    <span className="text-text-primary font-medium ml-2">
                      {formatCurrency(sub.total)}
                    </span>
                    <span className="text-text-dimmed text-xs w-12 text-right">
                      {sub.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${sub.percentage}%`,
                        backgroundColor: color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top 5 gastos */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Top 5 gastos
            </h3>
            <div className="space-y-2">
              {topExpenses.map((expense, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between py-2 border-b border-border-subtle last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-text-dimmed">
                      {new Date(expense.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-text-primary ml-2">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year.slice(2)}`;
}
