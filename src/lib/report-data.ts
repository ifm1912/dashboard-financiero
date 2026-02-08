import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  getMRRMetrics,
  getContractEvents,
  formatCurrency,
  formatPercent,
} from './data';
import { calculateCashflowMetrics, getExpensesByCategoryFiltered, generateCashflowChartData, getRunwayEndDate } from './cashflow';
import { calculateForecast } from './forecast';
import { Contract, ContractEvent, ExpenseCategory } from '@/types';

export interface ExecutiveReportData {
  reportMonth: string;
  reportDate: string;
  fiscalYear: number;

  // Page 1: Financial Health
  revenueYTD: number;
  arrActual: number;
  arrGrowth: number;
  cashBalance: number;
  runway: number;
  netBurn: number;
  burnRate: number;

  // Alerts
  contractsAtRisk: { client: string; product: string; arr: number; endDate: string }[];
  arrEnRiesgo: number;
  pendingAmount: number;
  pendingPercentage: number;

  // Operational summary
  clientesActivos: number;
  recurringPercentage: number;
  dso: number;
  collectionRate: number;

  // Page 2: Revenue & Growth
  monthlyRevenue: { month: string; recurring: number; nonRecurring: number; total: number }[];
  mrrTrend: { month: string; mrr: number; arr: number }[];
  forecastM1: number;
  forecastM3: number;
  forecastM6: number;
  forecastM12: number;
  facturadoYTD: number;
  forecastRestanteFY: number;
  totalEstimadoFY: number;

  // Page 3: Cash Flow
  avgMonthlyInflow: number;
  cashflowMonthly: { month: string; inflow: number; outflow: number; net: number }[];
  expensesByCategory: { category: string; total: number; percentage: number }[];
  runwayEndDate: string;

  // Page 4: Contracts & Customers
  arrBase: number;
  expansion: number;
  churn: number;
  pipelineARR: number;
  activeContracts: number;
  activeClients: number;
  clientConcentration: { name: string; arr: number; percentage: number }[];
  upcomingRenewals: { client: string; product: string; arr: number; endDate: string }[];
}

// Formatting helpers for the PDF (reuse app patterns)
export { formatCurrency, formatPercent };

export function formatReportMonth(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function formatShortMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

export async function collectReportData(): Promise<ExecutiveReportData> {
  const [invoices, contracts, cashBalanceData, expenses, inflows, mrrData, contractEvents] = await Promise.all([
    getInvoices(),
    getContracts(),
    getCashBalance(),
    getExpenses(),
    getInflows(),
    getMRRMetrics(),
    getContractEvents(),
  ]);

  const today = new Date();
  const currentYear = today.getFullYear();

  // --- Financial Health (same logic as page.tsx) ---
  const activeContracts = contracts.filter(c => c.status === 'activo');
  const pipelineContracts = contracts.filter(c => c.status === 'negociación');

  const ytdInvoices = invoices.filter(inv => inv.invoice_year === currentYear);
  const ingresosYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
  const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);

  const sixMonthsAgo = mrrData.length >= 7 ? mrrData[mrrData.length - 7] : null;
  const arrSixMonthsAgo = sixMonthsAgo ? sixMonthsAgo.arr_approx : 0;
  const arrGrowth = arrSixMonthsAgo > 0 ? ((arrActual - arrSixMonthsAgo) / arrSixMonthsAgo) * 100 : 0;

  const cfMetrics = calculateCashflowMetrics(expenses, inflows, cashBalanceData, 6);

  // --- Alerts ---
  const ninetyDaysFromNow = new Date(today);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const contractsAtRisk = activeContracts
    .filter(c => {
      if (!c.end_date) return false;
      const endDate = new Date(c.end_date);
      return endDate <= ninetyDaysFromNow && endDate >= today;
    })
    .map(c => ({
      client: c.client_name,
      product: c.product,
      arr: c.current_price_annual,
      endDate: c.end_date!,
    }));
  const arrEnRiesgo = contractsAtRisk.reduce((sum, c) => sum + c.arr, 0);

  const totalFacturadoYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
  const facturasPendientesYTD = ytdInvoices.filter(inv => inv.status !== 'paid');
  const pendingAmount = facturasPendientesYTD.reduce((sum, inv) => sum + inv.amount_net, 0);
  const pendingPercentage = totalFacturadoYTD > 0 ? (pendingAmount / totalFacturadoYTD) * 100 : 0;

  // --- Operational ---
  const facturasConPago = invoices.filter(
    inv => inv.status === 'paid' && inv.days_to_pay !== null && inv.days_to_pay !== undefined
  );
  const dso = facturasConPago.length > 0
    ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
    : 0;

  const facturasYTD = ytdInvoices.length;
  const facturasPagadasYTD = ytdInvoices.filter(inv => inv.status === 'paid').length;
  const collectionRate = facturasYTD > 0 ? (facturasPagadasYTD / facturasYTD) * 100 : 0;

  const fourMonthsAgo = new Date(today);
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
  const recentInvoices = invoices.filter(inv => new Date(inv.invoice_date) >= fourMonthsAgo);
  const clientesActivos = new Set(recentInvoices.map(inv => inv.customer_name)).size;

  const recurringYTD = ytdInvoices
    .filter(inv => inv.revenue_category === 'recurring')
    .reduce((sum, inv) => sum + inv.amount_net, 0);
  const recurringPercentage = ingresosYTD > 0 ? (recurringYTD / ingresosYTD) * 100 : 0;

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

  // --- MRR Trend (last 6 months) ---
  const mrrTrend = mrrData.slice(-6).map(d => ({
    month: d.month,
    mrr: d.mrr_approx,
    arr: d.arr_approx,
  }));

  // --- Forecast ---
  const forecast = calculateForecast(contracts, invoices);

  // --- Cash Flow monthly (last 6 months) ---
  const cashflowChart = generateCashflowChartData(expenses, inflows, 6);
  const cashflowMonthly = cashflowChart.map(p => ({
    month: p.month,
    inflow: p.inflow,
    outflow: p.outflow,
    net: p.net,
  }));

  // --- Expenses by category ---
  const expensesByCategory = getExpensesByCategoryFiltered(expenses, 6).map(e => ({
    category: e.category as string,
    total: e.total,
    percentage: e.percentage,
  }));

  // --- Contracts & Customers ---
  const arrBase = activeContracts.reduce((sum, c) => sum + c.base_arr_eur, 0);
  const expansion = arrActual - arrBase;

  const churn = contractEvents
    .filter((e: ContractEvent) => e.event_type === 'CANCELACIÓN')
    .reduce((sum: number, e: ContractEvent) => sum + Math.abs(e.arr_delta), 0);

  const pipelineARR = pipelineContracts.reduce((sum, c) => sum + c.current_price_annual, 0);

  const arrTotal = arrActual;
  const clientConcentration = activeContracts
    .filter(c => c.current_price_annual > 0)
    .map(c => ({
      name: c.client_name,
      arr: c.current_price_annual,
      percentage: arrTotal > 0 ? (c.current_price_annual / arrTotal) * 100 : 0,
    }))
    .sort((a, b) => b.arr - a.arr)
    .slice(0, 5);

  const runwayMonths = cfMetrics.runwayMonths === -1 ? Infinity : cfMetrics.runwayMonths;

  return {
    reportMonth: formatReportMonth(today),
    reportDate: today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    fiscalYear: currentYear,

    revenueYTD: ingresosYTD,
    arrActual,
    arrGrowth,
    cashBalance: cashBalanceData.current_balance,
    runway: runwayMonths,
    netBurn: cfMetrics.netBurn,
    burnRate: cfMetrics.burnRate,

    contractsAtRisk,
    arrEnRiesgo,
    pendingAmount,
    pendingPercentage,

    clientesActivos,
    recurringPercentage,
    dso,
    collectionRate,

    monthlyRevenue,
    mrrTrend,
    forecastM1: forecast.forecastM1,
    forecastM3: forecast.forecastM3,
    forecastM6: forecast.forecastM6,
    forecastM12: forecast.forecastM12,
    facturadoYTD: forecast.facturadoYTD,
    forecastRestanteFY: forecast.forecastRestanteFY,
    totalEstimadoFY: forecast.totalEstimadoFY,

    avgMonthlyInflow: cfMetrics.avgMonthlyInflow,
    cashflowMonthly,
    expensesByCategory,
    runwayEndDate: cfMetrics.runwayEndDate,

    arrBase,
    expansion,
    churn,
    pipelineARR,
    activeContracts: activeContracts.length,
    activeClients: new Set(activeContracts.map(c => c.client_name)).size,
    clientConcentration,
    upcomingRenewals: contractsAtRisk,
  };
}
