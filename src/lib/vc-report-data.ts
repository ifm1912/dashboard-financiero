import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  formatCurrency,
  formatPercent,
} from './data';
import { calculateCashflowMetrics } from './cashflow';
import { VCPeriod } from '@/types';

export { formatCurrency, formatPercent };

export interface VCReportData {
  // Meta
  reportDate: string;
  periodLabel: string;
  periodType: 'year' | 'quarter';
  periodYear: number;
  customText: string;

  // Revenue (Page 1 - Section 1)
  totalRevenuePeriod: number;
  revenueQuarter: number | null;
  revenueYTD: number | null;
  mrrCurrent: number;
  arrCurrent: number;

  // Clients & Usage (Page 1 - Section 2)
  totalClients: number;
  monthlyActiveUsers: string;
  dailyChats: string;

  // Pipeline (Page 1 - Section 3)
  pipelineTotalARR: number;
  pipelineDealCount: number;
  pipelineClientNames: string[];

  // Cash (Page 1 - Section 4)
  cashBalance: number;
  cashBalanceDate: string;
  burnRate: number;
  netBurn: number;
  runway: number;

  // Financiación (Page 2)
  financiacion: { label: string; amount: number; detail: string }[];
}

function buildPeriodLabel(period: VCPeriod): string {
  if (period.type === 'year') {
    return `FY ${period.year}`;
  }
  const quarterMonths: Record<number, string> = {
    1: 'Jan\u2013Mar',
    2: 'Apr\u2013Jun',
    3: 'Jul\u2013Sep',
    4: 'Oct\u2013Dec',
  };
  return `Q${period.quarter} ${period.year} (${quarterMonths[period.quarter!]})`;
}

function buildQuarterKey(year: number, quarter: number): string {
  return `${year}Q${quarter}`;
}

export async function collectVCReportData(
  period: VCPeriod,
  customText: string,
  manualMRR: number,
  manualARR: number
): Promise<VCReportData> {
  const [invoices, contracts, cashBalanceData, expenses, inflows] =
    await Promise.all([
      getInvoices(),
      getContracts(),
      getCashBalance(),
      getExpenses(),
      getInflows(),
    ]);

  const today = new Date();

  // --- Filter invoices by period ---
  let periodInvoices;

  if (period.type === 'year') {
    periodInvoices = invoices.filter((inv) => inv.invoice_year === period.year);
  } else {
    const qKey = buildQuarterKey(period.year, period.quarter!);
    periodInvoices = invoices.filter((inv) => inv.invoice_quarter === qKey);
  }

  const totalRevenuePeriod = periodInvoices.reduce(
    (sum, inv) => sum + inv.amount_net,
    0
  );

  // --- Revenue YTD (full year revenue) ---
  const ytdInvoices = invoices.filter(
    (inv) => inv.invoice_year === period.year
  );
  const revenueYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);

  // --- Revenue Quarter (current quarter) ---
  let revenueQuarter: number | null = null;
  if (period.type === 'quarter') {
    revenueQuarter = totalRevenuePeriod;
  } else {
    // For yearly reports, calculate current quarter revenue
    const currentQ = Math.ceil((today.getMonth() + 1) / 3);
    const qKey = buildQuarterKey(period.year, currentQ);
    const qInvoices = invoices.filter((inv) => inv.invoice_quarter === qKey);
    revenueQuarter = qInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
  }

  // --- Cash & Sustainability ---
  const cfMetrics = calculateCashflowMetrics(
    expenses,
    inflows,
    cashBalanceData,
    6
  );
  const runway =
    cfMetrics.runwayMonths === -1 ? Infinity : cfMetrics.runwayMonths;

  // --- Total clients (unique customer_name across all invoices) ---
  const totalClients = new Set(
    invoices.map((inv) => inv.customer_name)
  ).size;

  // --- Pipeline ---
  const pipelineContracts = contracts
    .filter((c) => c.status === 'negociación')
    .sort((a, b) => b.current_price_annual - a.current_price_annual);
  const pipelineTotalARR = pipelineContracts.reduce(
    (sum, c) => sum + c.current_price_annual,
    0
  );
  const pipelineDealCount = pipelineContracts.length;
  const pipelineClientNames = pipelineContracts.map((c) => c.client_name);

  // --- Financiación (static data) ---
  const financiacion = [
    {
      label: 'Subvención Neotec',
      amount: 325000,
      detail: 'Subvención CDTI — Neotec',
    },
    {
      label: 'Préstamo ENISA',
      amount: 225000,
      detail: 'Concedido en diciembre 2025',
    },
  ];

  return {
    reportDate: today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    periodLabel: buildPeriodLabel(period),
    periodType: period.type,
    periodYear: period.year,
    customText,

    totalRevenuePeriod,
    revenueQuarter,
    revenueYTD,
    mrrCurrent: manualMRR,
    arrCurrent: manualARR,

    totalClients,
    monthlyActiveUsers: '>100.000',
    dailyChats: '>6.000',

    pipelineTotalARR,
    pipelineDealCount,
    pipelineClientNames,

    cashBalance: cashBalanceData.current_balance,
    cashBalanceDate: cashBalanceData.last_updated,
    burnRate: cfMetrics.burnRate,
    netBurn: cfMetrics.netBurn,
    runway,

    financiacion,
  };
}
