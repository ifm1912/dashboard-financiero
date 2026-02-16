/**
 * Unified data collector for block-based custom reports.
 * Merges data from all three existing collectors into a single interface.
 */

import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  getMRRMetrics,
  getContractEvents,
  getFinancing,
  getUsageMetrics,
  formatCurrency,
  formatPercent,
} from './data';
import {
  calculateCashflowMetrics,
  getExpensesByCategoryFiltered,
  generateCashflowChartData,
} from './cashflow';
import { calculateForecast } from './forecast';
import { ContractEvent } from '@/types';

export interface BlockReportData {
  // Meta
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

  // Recurring
  currentARR: number;
  currentMRR: number;
  arrGrowth: number;
  recurringPercentage: number;

  // Revenue Chart (last 6 months)
  monthlyRevenue: { month: string; recurring: number; nonRecurring: number; total: number }[];

  // MRR Trend (last 6 months)
  mrrTrend: { month: string; mrr: number; arr: number }[];

  // Clients
  totalClients: number;
  recurringClients: number;
  clientesActivos: number;
  clientConcentration: { name: string; arr: number; percentage: number }[];

  // Usage
  usageTotalUsers: number | null;
  usageAvgDailyChats: number | null;
  usageReportDate: string | null;

  // Pipeline
  pipelineARR: number;
  pipelineCount: number;
  pipelineClientNames: string[];

  // Cash
  cashBalance: number;
  cashBalanceDate: string;
  burnRate: number;
  netBurn: number;
  avgMonthlyInflow: number;
  runway: number;
  runwayEndDate: string;

  // Cashflow Chart (last 6 months)
  cashflowMonthly: { month: string; inflow: number; outflow: number; net: number }[];

  // Expenses
  expensesByCategory: { category: string; total: number; percentage: number }[];

  // Financing
  financiacion: { label: string; amount: number; detail: string }[];

  // Efficiency
  dso: number;
  collectionRate: number;
  pendingAmount: number;
  pendingPercentage: number;

  // Contracts
  arrBase: number;
  arrActual: number;
  expansion: number;
  churn: number;
  activeContracts: number;
  activeClients: number;
  upcomingRenewals: { client: string; product: string; arr: number; endDate: string }[];

  // Forecast
  forecastM1: number;
  forecastM3: number;
  forecastM6: number;
  forecastM12: number;
  facturadoYTD: number;
  forecastRestanteFY: number;
  totalEstimadoFY: number;

  // Alerts
  contractsAtRisk: { client: string; product: string; arr: number; endDate: string }[];
  arrEnRiesgo: number;
}

export { formatCurrency, formatPercent };

export function formatReportMonth(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function formatShortMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

export async function collectBlockReportData(customNote: string): Promise<BlockReportData> {
  const [invoices, contracts, cashBalanceData, expenses, inflows, mrrData, contractEvents, financingData, usageMetrics] =
    await Promise.all([
      getInvoices(),
      getContracts(),
      getCashBalance(),
      getExpenses(),
      getInflows(),
      getMRRMetrics(),
      getContractEvents(),
      getFinancing(),
      getUsageMetrics(),
    ]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const priorFiscalYear = currentYear - 1;
  const currentMonth = today.getMonth() + 1;

  // --- Active / pipeline contracts ---
  const activeContracts = contracts.filter(c => c.status === 'activo');
  const pipelineContracts = contracts.filter(c => c.status === 'negociación');

  // --- Revenue Performance ---
  const revenuePriorFY = invoices
    .filter(inv => inv.invoice_year === priorFiscalYear)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  const ytdInvoices = invoices.filter(inv => inv.invoice_year === currentYear);
  const revenueYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);

  const currentQuarter = Math.ceil(currentMonth / 3);
  const lastCompleteQuarterLabel = currentQuarter === 1
    ? `${priorFiscalYear}Q4`
    : `${currentYear}Q${currentQuarter - 1}`;
  const revenueLastQuarter = invoices
    .filter(inv => inv.invoice_quarter === lastCompleteQuarterLabel)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  const lastCompleteMonth = currentMonth === 1
    ? { year: currentYear - 1, month: 12 }
    : { year: currentYear, month: currentMonth - 1 };
  const lastCompleteMonthLabel = new Date(lastCompleteMonth.year, lastCompleteMonth.month - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const revenueLastMonth = invoices
    .filter(inv => inv.invoice_year === lastCompleteMonth.year && inv.invoice_month === lastCompleteMonth.month)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  // --- Recurring Metrics ---
  const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
  const currentMRR = mrrData.length > 0 ? mrrData[mrrData.length - 1].mrr_approx : 0;
  const sixMonthsAgo = mrrData.length >= 7 ? mrrData[mrrData.length - 7] : null;
  const arrSixMonthsAgo = sixMonthsAgo ? sixMonthsAgo.arr_approx : 0;
  const arrGrowth = arrSixMonthsAgo > 0 ? ((arrActual - arrSixMonthsAgo) / arrSixMonthsAgo) * 100 : 0;

  const recurringYTD = ytdInvoices
    .filter(inv => inv.revenue_category === 'recurring')
    .reduce((sum, inv) => sum + inv.amount_net, 0);
  const recurringPercentage = revenueYTD > 0 ? (recurringYTD / revenueYTD) * 100 : 0;

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

  // --- Clients ---
  const totalClients = new Set(invoices.map(inv => inv.customer_name)).size;
  const recurringClients = activeContracts.length;
  const fourMonthsAgo = new Date(today);
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
  const recentInvoices = invoices.filter(inv => new Date(inv.invoice_date) >= fourMonthsAgo);
  const clientesActivos = new Set(recentInvoices.map(inv => inv.customer_name)).size;

  const clientConcentration = activeContracts
    .filter(c => c.current_price_annual > 0)
    .map(c => ({
      name: c.client_name,
      arr: c.current_price_annual,
      percentage: arrActual > 0 ? (c.current_price_annual / arrActual) * 100 : 0,
    }))
    .sort((a, b) => b.arr - a.arr)
    .slice(0, 5);

  // --- Usage ---
  const usageTotalUsers = usageMetrics?.latest?.total_users ?? null;
  const usageAvgDailyChats = usageMetrics?.latest?.avg_daily_conversations ?? null;
  const usageReportDate = usageMetrics?.latest?.date ?? null;

  // --- Pipeline ---
  const pipelineARR = pipelineContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
  const pipelineCount = pipelineContracts.length;
  const pipelineClientNames = pipelineContracts
    .sort((a, b) => b.current_price_annual - a.current_price_annual)
    .map(c => c.client_name);

  // --- Cash ---
  const cfMetrics = calculateCashflowMetrics(expenses, inflows, cashBalanceData, 6);
  const runway = cfMetrics.runwayMonths === -1 ? Infinity : cfMetrics.runwayMonths;

  // --- Cashflow chart ---
  const cashflowChart = generateCashflowChartData(expenses, inflows, 6);
  const cashflowMonthly = cashflowChart.map(p => ({
    month: p.month,
    inflow: p.inflow,
    outflow: p.outflow,
    net: p.net,
  }));

  // --- Expenses (12 months) ---
  const expensesByCategory = getExpensesByCategoryFiltered(expenses, 12).map(e => ({
    category: e.category as string,
    total: e.total,
    percentage: e.percentage,
  }));

  // --- Financing ---
  const financiacion = [
    { label: 'Subvención Neotec', amount: 325000, detail: 'Subvención CDTI — Neotec' },
    { label: 'Préstamo ENISA', amount: 225000, detail: 'Concedido en diciembre 2025' },
  ];

  // --- Efficiency ---
  const facturasConPago = invoices.filter(
    inv => inv.status === 'paid' && inv.days_to_pay !== null && inv.days_to_pay !== undefined
  );
  const dso = facturasConPago.length > 0
    ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
    : 0;
  const facturasYTD = ytdInvoices.length;
  const facturasPagadasYTD = ytdInvoices.filter(inv => inv.status === 'paid').length;
  const collectionRate = facturasYTD > 0 ? (facturasPagadasYTD / facturasYTD) * 100 : 0;

  const facturasPendientesYTD = ytdInvoices.filter(inv => inv.status !== 'paid');
  const pendingAmount = facturasPendientesYTD.reduce((sum, inv) => sum + inv.amount_net, 0);
  const pendingPercentage = revenueYTD > 0 ? (pendingAmount / revenueYTD) * 100 : 0;

  // --- Contracts ---
  const arrBase = activeContracts.reduce((sum, c) => sum + c.base_arr_eur, 0);
  const expansion = arrActual - arrBase;
  const churn = contractEvents
    .filter((e: ContractEvent) => e.event_type === 'CANCELACIÓN')
    .reduce((sum: number, e: ContractEvent) => sum + Math.abs(e.arr_delta), 0);

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

  // --- Forecast ---
  const forecast = calculateForecast(contracts, invoices);

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

    currentARR: arrActual,
    currentMRR,
    arrGrowth,
    recurringPercentage,

    monthlyRevenue,
    mrrTrend,

    totalClients,
    recurringClients,
    clientesActivos,
    clientConcentration,

    usageTotalUsers,
    usageAvgDailyChats,
    usageReportDate,

    pipelineARR,
    pipelineCount,
    pipelineClientNames,

    cashBalance: cashBalanceData.current_balance,
    cashBalanceDate: cashBalanceData.last_updated,
    burnRate: cfMetrics.burnRate,
    netBurn: cfMetrics.netBurn,
    avgMonthlyInflow: cfMetrics.avgMonthlyInflow,
    runway,
    runwayEndDate: cfMetrics.runwayEndDate,

    cashflowMonthly,
    expensesByCategory,
    financiacion,

    dso,
    collectionRate,
    pendingAmount,
    pendingPercentage,

    arrBase,
    arrActual,
    expansion,
    churn,
    activeContracts: activeContracts.length,
    activeClients: new Set(activeContracts.map(c => c.client_name)).size,
    upcomingRenewals: contractsAtRisk,

    forecastM1: forecast.forecastM1,
    forecastM3: forecast.forecastM3,
    forecastM6: forecast.forecastM6,
    forecastM12: forecast.forecastM12,
    facturadoYTD: forecast.facturadoYTD,
    forecastRestanteFY: forecast.forecastRestanteFY,
    totalEstimadoFY: forecast.totalEstimadoFY,

    contractsAtRisk,
    arrEnRiesgo,
  };
}
