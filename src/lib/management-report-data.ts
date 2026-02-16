import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  getMRRMetrics,
  getUsageMetrics,
  formatCurrency,
  formatPercent,
} from './data';
import { calculateCashflowMetrics, getExpensesByCategoryFiltered, generateCashflowChartData } from './cashflow';
import { ExpenseCategory } from '@/types';

export interface ManagementReportData {
  reportMonth: string;
  reportDate: string;
  fiscalYear: number;
  customNote: string;

  // Revenue Performance
  revenuePriorFY: number;
  revenueYTD: number;
  revenueLastQuarter: number;
  lastCompleteQuarterLabel: string;
  revenueLastMonth: number;
  lastCompleteMonthLabel: string;

  // Recurring Metrics
  currentARR: number;
  currentMRR: number;
  arrGrowth: number; // % vs 6 months ago

  // Revenue Chart (last 6 months)
  monthlyRevenue: { month: string; recurring: number; nonRecurring: number; total: number }[];

  // Clients
  totalClients: number;
  recurringClients: number;
  clientConcentration: { name: string; arr: number; percentage: number }[];

  // Usage Metrics (from GPTadvisor)
  usageTotalUsers: number | null;
  usageAvgDailyChats: number | null;
  usageReportDate: string | null;

  // Cash & Runway
  cashBalance: number;
  burnRate: number;
  netBurn: number;
  runway: number;
  runwayEndDate: string;

  // Cashflow Chart
  cashflowMonthly: { month: string; inflow: number; outflow: number; net: number }[];

  // Expenses by Category
  expensesByCategory: { category: string; total: number; percentage: number }[];

  // Operational Efficiency
  dso: number;
  collectionRate: number;
  recurringPercentage: number;
}

// Reuse formatting helpers
export { formatCurrency, formatPercent };

export function formatReportMonth(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function formatShortMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

export async function collectManagementReportData(customNote: string): Promise<ManagementReportData> {
  const [invoices, contracts, cashBalanceData, expenses, inflows, mrrData, usageMetrics] = await Promise.all([
    getInvoices(),
    getContracts(),
    getCashBalance(),
    getExpenses(),
    getInflows(),
    getMRRMetrics(),
    getUsageMetrics(),
  ]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const priorFiscalYear = currentYear - 1;
  const currentMonth = today.getMonth() + 1;

  // --- Revenue Performance ---
  const revenuePriorFY = invoices
    .filter(inv => inv.invoice_year === priorFiscalYear)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  const ytdInvoices = invoices.filter(inv => inv.invoice_year === currentYear);
  const revenueYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);

  const currentQuarter = Math.ceil(currentMonth / 3);
  let lastCompleteQuarterLabel: string;
  if (currentQuarter === 1) {
    lastCompleteQuarterLabel = `${priorFiscalYear}Q4`;
  } else {
    lastCompleteQuarterLabel = `${currentYear}Q${currentQuarter - 1}`;
  }
  const revenueLastQuarter = invoices
    .filter(inv => inv.invoice_quarter === lastCompleteQuarterLabel)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  const lastCompleteMonth = currentMonth === 1
    ? { year: currentYear - 1, month: 12 }
    : { year: currentYear, month: currentMonth - 1 };
  const lastCompleteMonthLabel = new Date(lastCompleteMonth.year, lastCompleteMonth.month - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const revenueLastMonth = invoices
    .filter(inv =>
      inv.invoice_year === lastCompleteMonth.year &&
      inv.invoice_month === lastCompleteMonth.month
    )
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  // --- Recurring Metrics ---
  const activeContracts = contracts.filter(c => c.status === 'activo');
  const currentARR = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
  const currentMRR = mrrData.length > 0 ? mrrData[mrrData.length - 1].mrr_approx : 0;

  const sixMonthsAgo = mrrData.length >= 7 ? mrrData[mrrData.length - 7] : null;
  const arrSixMonthsAgo = sixMonthsAgo ? sixMonthsAgo.arr_approx : 0;
  const arrGrowth = arrSixMonthsAgo > 0 ? ((currentARR - arrSixMonthsAgo) / arrSixMonthsAgo) * 100 : 0;

  // --- Monthly Revenue (last 6 months) ---
  const monthlyMap = new Map<string, { recurring: number; nonRecurring: number }>();
  invoices.forEach(inv => {
    const m = inv.invoice_month_start?.substring(0, 7);
    if (!m) return;
    const entry = monthlyMap.get(m) || { recurring: 0, nonRecurring: 0 };
    if (inv.revenue_category === 'recurring') {
      entry.recurring += inv.amount_net;
    } else {
      entry.nonRecurring += inv.amount_net;
    }
    monthlyMap.set(m, entry);
  });
  const monthlyRevenue = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data, total: data.recurring + data.nonRecurring }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  // --- Clients ---
  const totalClients = new Set(invoices.map(inv => inv.customer_name)).size;
  const recurringClients = activeContracts.length;

  const arrTotal = currentARR;
  const clientConcentration = activeContracts
    .filter(c => c.current_price_annual > 0)
    .map(c => ({
      name: c.client_name,
      arr: c.current_price_annual,
      percentage: arrTotal > 0 ? (c.current_price_annual / arrTotal) * 100 : 0,
    }))
    .sort((a, b) => b.arr - a.arr)
    .slice(0, 5);

  // --- Usage Metrics ---
  const usageTotalUsers = usageMetrics?.latest?.total_users ?? null;
  const usageAvgDailyChats = usageMetrics?.latest?.avg_daily_conversations ?? null;
  const usageReportDate = usageMetrics?.latest?.date ?? null;

  // --- Cash ---
  const cfMetrics = calculateCashflowMetrics(expenses, inflows, cashBalanceData, 6);
  const runway = cfMetrics.runwayMonths === -1 ? Infinity : cfMetrics.runwayMonths;

  // --- Cashflow Chart ---
  const cashflowChart = generateCashflowChartData(expenses, inflows, 6);
  const cashflowMonthly = cashflowChart.map(p => ({
    month: p.month,
    inflow: p.inflow,
    outflow: p.outflow,
    net: p.net,
  }));

  // --- Expenses by Category (last 12 months) ---
  const expensesByCategory = getExpensesByCategoryFiltered(expenses, 12).map(e => ({
    category: e.category as string,
    total: e.total,
    percentage: e.percentage,
  }));

  // --- Operational Efficiency ---
  const facturasConPago = invoices.filter(
    inv => inv.status === 'paid' && inv.days_to_pay !== null && inv.days_to_pay !== undefined
  );
  const dso = facturasConPago.length > 0
    ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
    : 0;

  const facturasYTD = ytdInvoices.length;
  const facturasPagadasYTD = ytdInvoices.filter(inv => inv.status === 'paid').length;
  const collectionRate = facturasYTD > 0 ? (facturasPagadasYTD / facturasYTD) * 100 : 0;

  const recurringYTD = ytdInvoices
    .filter(inv => inv.revenue_category === 'recurring')
    .reduce((sum, inv) => sum + inv.amount_net, 0);
  const recurringPercentage = revenueYTD > 0 ? (recurringYTD / revenueYTD) * 100 : 0;

  return {
    reportMonth: formatReportMonth(today),
    reportDate: today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    fiscalYear: currentYear,
    customNote,

    revenuePriorFY,
    revenueYTD,
    revenueLastQuarter,
    lastCompleteQuarterLabel,
    revenueLastMonth,
    lastCompleteMonthLabel,

    currentARR,
    currentMRR,
    arrGrowth,

    monthlyRevenue,

    totalClients,
    recurringClients,
    clientConcentration,

    usageTotalUsers,
    usageAvgDailyChats,
    usageReportDate,

    cashBalance: cashBalanceData.current_balance,
    burnRate: cfMetrics.burnRate,
    netBurn: cfMetrics.netBurn,
    runway,
    runwayEndDate: cfMetrics.runwayEndDate,

    cashflowMonthly,
    expensesByCategory,

    dso,
    collectionRate,
    recurringPercentage,
  };
}
