import {
  Expense,
  CashBalance,
  CashflowMetrics,
  CashProjectionPoint,
  CashflowChartPoint,
  ExpenseCategory,
  Invoice,
  BankInflow
} from '@/types';

// ============================================
// Cálculos de Burn Rate
// ============================================

/**
 * Calcula el burn rate mensual promedio
 * Excluye 'Financiación' del cálculo (no es gasto operativo)
 */
export function calculateBurnRate(
  expenses: Expense[],
  months: number = 6
): number {
  // Filtrar solo gastos operativos (excluir Financiación)
  const operationalExpenses = expenses.filter(
    e => e.category !== 'Financiación'
  );

  if (operationalExpenses.length === 0) return 0;

  // Obtener los últimos N meses con datos
  const monthlyTotals = getMonthlyExpenses(operationalExpenses);
  const recentMonths = monthlyTotals.slice(-months);

  if (recentMonths.length === 0) return 0;

  // Promedio (los importes son negativos, así que el resultado es negativo)
  const total = recentMonths.reduce((sum, m) => sum + m.total, 0);
  return total / recentMonths.length;
}

/**
 * Agrupa gastos por mes y calcula totales
 */
export function getMonthlyExpenses(
  expenses: Expense[]
): { month: string; total: number }[] {
  const byMonth = new Map<string, number>();

  expenses.forEach(expense => {
    const month = expense.expense_date.substring(0, 7); // YYYY-MM
    const current = byMonth.get(month) || 0;
    byMonth.set(month, current + expense.amount);
  });

  return Array.from(byMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Agrupa gastos por categoría
 */
export function getExpensesByCategory(
  expenses: Expense[]
): { category: ExpenseCategory; total: number; percentage: number }[] {
  const byCategory = new Map<ExpenseCategory, number>();

  expenses.forEach(expense => {
    const current = byCategory.get(expense.category) || 0;
    byCategory.set(expense.category, current + expense.amount);
  });

  const grandTotal = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);

  return Array.from(byCategory.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: grandTotal !== 0 ? (total / grandTotal) * 100 : 0
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)); // Mayor gasto primero
}

/**
 * Agrupa gastos por categoría con filtro de período
 * @param expenses - Array de gastos
 * @param monthsToInclude - Número de meses a incluir (0 = todos)
 * @returns Array de gastos por categoría con totales absolutos
 */
export function getExpensesByCategoryFiltered(
  expenses: Expense[],
  monthsToInclude: number = 0
): { category: ExpenseCategory; total: number; percentage: number }[] {
  // Excluir Financiación y gastos sin categoría
  let filtered = expenses.filter(e => e.category && e.category.trim() !== '' && e.category !== 'Financiación');

  // Filtrar por período si se especifica
  if (monthsToInclude > 0) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToInclude);
    filtered = filtered.filter(e => new Date(e.expense_date) >= cutoffDate);
  }

  // Calcular totales por categoría
  const result = getExpensesByCategory(filtered);

  // Convertir a valores absolutos para mostrar
  return result.map(e => ({
    ...e,
    total: Math.abs(e.total)
  }));
}

// ============================================
// Cálculos de Cash Inflow
// ============================================

// Categorías de financiación a excluir del cálculo de ingresos operativos
const FINANCING_CATEGORIES = [
  'ENISA',
  'Subvención',
  'TaxLease',
  'Reembolso',
  'Prestamo',
  'Préstamo',
  'SeedRound',
  'Financing',
  'Financiación',
];

/**
 * Calcula el promedio mensual de inflows bancarios operativos
 * Usa datos reales del banco (no facturas)
 * Excluye categorías de financiación (ENISA, Subvención, TaxLease, etc.)
 */
export function calculateAvgMonthlyInflow(
  inflows: BankInflow[],
  months: number = 6
): number {
  if (inflows.length === 0) return 0;

  // Filtrar solo inflows operativos (excluir financiación)
  const operationalInflows = inflows.filter(
    i => !FINANCING_CATEGORIES.includes(i.category)
  );

  if (operationalInflows.length === 0) return 0;

  // Agrupar por mes
  const byMonth = new Map<string, number>();
  operationalInflows.forEach(inflow => {
    const month = inflow.inflow_date.substring(0, 7); // YYYY-MM
    const current = byMonth.get(month) || 0;
    byMonth.set(month, current + inflow.amount);
  });

  const monthlyTotals = Array.from(byMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Últimos N meses
  const recentMonths = monthlyTotals.slice(-months);
  if (recentMonths.length === 0) return 0;

  const total = recentMonths.reduce((sum, m) => sum + m.total, 0);
  return total / recentMonths.length;
}

/**
 * @deprecated Usa calculateAvgMonthlyInflow con BankInflow[] en su lugar
 */
export function calculateAvgMonthlyInflowFromInvoices(
  invoices: Invoice[],
  months: number = 6
): number {
  const paidInvoices = invoices.filter(
    inv => inv.status === 'paid' && inv.payment_date
  );

  if (paidInvoices.length === 0) return 0;

  const byMonth = new Map<string, number>();
  paidInvoices.forEach(inv => {
    if (inv.payment_month_start) {
      const month = inv.payment_month_start.substring(0, 7);
      const current = byMonth.get(month) || 0;
      byMonth.set(month, current + inv.amount_net);
    }
  });

  const monthlyTotals = Array.from(byMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const recentMonths = monthlyTotals.slice(-months);
  if (recentMonths.length === 0) return 0;

  const total = recentMonths.reduce((sum, m) => sum + m.total, 0);
  return total / recentMonths.length;
}

/**
 * @deprecated Usa getMonthlyBankInflows en su lugar para movimientos bancarios reales
 * Obtiene cobros mensuales de facturas (no datos bancarios)
 */
export function getMonthlyInflows(
  invoices: Invoice[]
): { month: string; total: number }[] {
  const paidInvoices = invoices.filter(
    inv => inv.status === 'paid' && inv.payment_date
  );

  const byMonth = new Map<string, number>();
  paidInvoices.forEach(inv => {
    if (inv.payment_month_start) {
      const month = inv.payment_month_start.substring(0, 7);
      const current = byMonth.get(month) || 0;
      byMonth.set(month, current + inv.amount_net);
    }
  });

  return Array.from(byMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Obtiene inflows bancarios mensuales (movimientos reales del banco)
 * Excluye categorías de financiación (ENISA, Subvención, etc.)
 */
export function getMonthlyBankInflows(
  inflows: BankInflow[]
): { month: string; total: number }[] {
  // Filtrar solo inflows operativos (excluir financiación)
  const operationalInflows = inflows.filter(
    i => !FINANCING_CATEGORIES.includes(i.category)
  );

  const byMonth = new Map<string, number>();
  operationalInflows.forEach(inflow => {
    const month = inflow.inflow_date.substring(0, 7);
    const current = byMonth.get(month) || 0;
    byMonth.set(month, current + inflow.amount);
  });

  return Array.from(byMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================
// Cálculos de Runway
// ============================================

/**
 * Calcula el net burn (burn rate - inflows)
 * Positivo = quemando caja, Negativo = generando caja
 */
export function calculateNetBurn(
  burnRate: number,
  avgInflow: number
): number {
  // burnRate es negativo, avgInflow es positivo
  // Net burn positivo significa que estamos quemando caja
  return Math.abs(burnRate) - avgInflow;
}

/**
 * Calcula el runway en meses
 */
export function calculateRunway(
  currentCash: number,
  netBurn: number
): number {
  if (netBurn <= 0) {
    // No estamos quemando caja (generando más de lo que gastamos)
    return Infinity;
  }

  return currentCash / netBurn;
}

/**
 * Obtiene la fecha estimada de fin de runway
 */
export function getRunwayEndDate(runwayMonths: number): string {
  if (!isFinite(runwayMonths)) {
    return 'Indefinido';
  }

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + Math.floor(runwayMonths));

  return endDate.toISOString().split('T')[0];
}

// ============================================
// Proyecciones
// ============================================

/**
 * Genera proyección de caja para los próximos N meses
 * @param currentCash - Balance actual de caja
 * @param netBurn - Net burn mensual (gastos - ingresos)
 * @param projectionMonths - Meses de proyección futura (default: 12)
 * @param cashHistory - Histórico de balances
 * @param historicalMonthsCount - Meses de histórico a mostrar (0 = todo)
 */
export function projectCashflow(
  currentCash: number,
  netBurn: number,
  projectionMonths: number = 12,
  cashHistory: { month: string; balance: number }[] = [],
  historicalMonthsCount: number = 0
): CashProjectionPoint[] {
  const points: CashProjectionPoint[] = [];
  const now = new Date();

  // Ordenar histórico por fecha descendente (más reciente primero)
  const sortedHistory = [...cashHistory].sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  // Determinar cuántos meses de histórico mostrar (0 = todo)
  const historyCount = historicalMonthsCount > 0
    ? historicalMonthsCount
    : sortedHistory.length;

  // Tomar los N más recientes y reordenar ascendente para el gráfico
  const historicalMonths = sortedHistory
    .slice(0, historyCount)
    .sort((a, b) => a.month.localeCompare(b.month));

  historicalMonths.forEach(h => {
    points.push({
      month: h.month,
      monthLabel: formatMonthLabel(h.month),
      projected: h.balance,
      isHistorical: true
    });
  });

  // Añadir proyección futura
  let projectedCash = currentCash;
  for (let i = 1; i <= projectionMonths; i++) {
    const futureDate = new Date(now);
    futureDate.setMonth(now.getMonth() + i);
    const month = futureDate.toISOString().substring(0, 7);

    projectedCash = Math.max(0, projectedCash - netBurn);

    points.push({
      month,
      monthLabel: formatMonthLabel(month),
      projected: projectedCash,
      isHistorical: false
    });
  }

  return points;
}

/**
 * Genera datos para gráfico de inflows vs outflows
 * Usa movimientos bancarios reales, no facturas
 */
export function generateCashflowChartData(
  expenses: Expense[],
  inflows: BankInflow[],
  months: number = 12
): CashflowChartPoint[] {
  // Filtrar gastos operativos (excluir financiación)
  const operationalExpenses = expenses.filter(e => e.category !== 'Financiación');
  const monthlyExpenses = getMonthlyExpenses(operationalExpenses);
  const monthlyInflows = getMonthlyBankInflows(inflows);

  // Obtener todos los meses únicos
  const allMonths = new Set<string>();
  monthlyExpenses.forEach(m => allMonths.add(m.month));
  monthlyInflows.forEach(m => allMonths.add(m.month));

  // Ordenar y tomar los últimos N meses
  const sortedMonths = Array.from(allMonths)
    .sort()
    .slice(-months);

  // Crear mapa para acceso rápido
  const expenseMap = new Map(monthlyExpenses.map(m => [m.month, m.total]));
  const inflowMap = new Map(monthlyInflows.map(m => [m.month, m.total]));

  return sortedMonths.map(month => {
    const outflow = Math.abs(expenseMap.get(month) || 0);
    const inflow = inflowMap.get(month) || 0;

    return {
      month,
      monthLabel: formatMonthLabel(month),
      inflow,
      outflow,
      net: inflow - outflow
    };
  });
}

/**
 * Obtiene solo el histórico de caja (sin proyección)
 */
export function getCashHistory(
  cashHistory: { month: string; balance: number }[],
  monthsToShow: number = 0
): CashProjectionPoint[] {
  const sorted = [...cashHistory].sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  const count = monthsToShow > 0 ? monthsToShow : sorted.length;

  return sorted.slice(0, count)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(h => ({
      month: h.month,
      monthLabel: formatMonthLabel(h.month),
      projected: h.balance,
      isHistorical: true
    }));
}

// ============================================
// Función principal de cálculo
// ============================================

/**
 * Calcula todas las métricas de cashflow
 * @param expenses - Gastos del banco
 * @param inflows - Inflows operativos del banco (excluyendo Financing/Seed)
 * @param cashBalance - Balance actual de caja
 * @param burnRatePeriod - Número de meses para calcular promedios
 */
export function calculateCashflowMetrics(
  expenses: Expense[],
  inflows: BankInflow[],
  cashBalance: CashBalance,
  burnRatePeriod: number = 6
): CashflowMetrics {
  // Burn rate (últimos N meses, excluyendo financiación)
  const burnRate = calculateBurnRate(expenses, burnRatePeriod);

  // Inflows promedio (usando datos bancarios reales)
  const avgMonthlyInflow = calculateAvgMonthlyInflow(inflows, burnRatePeriod);

  // Net burn
  const netBurn = calculateNetBurn(burnRate, avgMonthlyInflow);

  // Runway
  const runwayMonths = calculateRunway(cashBalance.current_balance, netBurn);
  const runwayEndDate = getRunwayEndDate(runwayMonths);

  // Breakdown por categoría (solo gastos operativos)
  const operationalExpenses = expenses.filter(e => e.category !== 'Financiación');
  const expensesByCategory = getExpensesByCategory(operationalExpenses);

  return {
    currentCash: cashBalance.current_balance,
    lastUpdated: cashBalance.last_updated,
    burnRate: Math.abs(burnRate), // Convertir a positivo para mostrar
    burnRatePeriod,
    avgMonthlyInflow,
    netBurn,
    runwayMonths: isFinite(runwayMonths) ? runwayMonths : -1, // -1 indica infinito
    runwayEndDate,
    expensesByCategory: expensesByCategory.map(e => ({
      ...e,
      total: Math.abs(e.total) // Convertir a positivo para mostrar
    }))
  };
}

// ============================================
// Utilidades
// ============================================

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year.slice(2)}`;
}

/**
 * Filtra gastos por rango de fechas
 */
export function filterExpensesByDate(
  expenses: Expense[],
  startDate: Date,
  endDate: Date
): Expense[] {
  return expenses.filter(expense => {
    const expenseDate = new Date(expense.expense_date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });
}
