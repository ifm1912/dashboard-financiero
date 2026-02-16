import Papa from 'papaparse';
import { Invoice, MonthlyMetric, MRRMetric, KPIData, ChartDataPoint, Contract, ContractEvent, Expense, CashBalance, BankInflow, BillingClient, FinancingData, UsageMetrics } from '@/types';
import { DateRange } from '@/contexts/DateRangeContext';
import { normalizeExpenseSubcategory } from './expense-normalizer';

const BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

export async function fetchCSV<T>(filename: string): Promise<T[]> {
  const response = await fetch(`${BASE_URL}/data/${filename}`);
  const text = await response.text();

  const result = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  return result.data;
}

export async function getInvoices(): Promise<Invoice[]> {
  const data = await fetchCSV<Invoice>('facturas_historicas_enriquecido.csv');
  return data.map(invoice => ({
    ...invoice,
    is_recurring: invoice.is_recurring === true || invoice.is_recurring === 'True' as unknown as boolean,
  }));
}

export async function getMonthlyMetrics(): Promise<MonthlyMetric[]> {
  return fetchCSV<MonthlyMetric>('metricas_recurring_vs_non_recurring.csv');
}

export async function getMRRMetrics(): Promise<MRRMetric[]> {
  return fetchCSV<MRRMetric>('mrr_aproximado_por_mes.csv');
}

export async function getKPIData(): Promise<KPIData> {
  const [invoices, mrrMetrics] = await Promise.all([
    getInvoices(),
    getMRRMetrics(),
  ]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount_net, 0);
  const recurringRevenue = invoices
    .filter(inv => inv.revenue_category === 'recurring')
    .reduce((sum, inv) => sum + inv.amount_net, 0);
  const nonRecurringRevenue = invoices
    .filter(inv => inv.revenue_category === 'non_recurring')
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  const latestMRR = mrrMetrics[mrrMetrics.length - 1];

  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length;

  const uniqueCustomers = new Set(invoices.map(inv => inv.customer_name)).size;

  return {
    totalRevenue,
    recurringRevenue,
    nonRecurringRevenue,
    currentMRR: latestMRR?.mrr_approx || 0,
    currentARR: latestMRR?.arr_approx || 0,
    recurringPercentage: (recurringRevenue / totalRevenue) * 100,
    totalInvoices: invoices.length,
    paidInvoices,
    pendingInvoices,
    uniqueCustomers,
  };
}

export async function getMonthlyChartData(): Promise<ChartDataPoint[]> {
  const metrics = await getMonthlyMetrics();

  if (metrics.length === 0) {
    return [];
  }

  const monthlyMap = new Map<string, { recurring: number; non_recurring: number }>();

  metrics.forEach(m => {
    const month = m.invoice_month_start;
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { recurring: 0, non_recurring: 0 });
    }

    const entry = monthlyMap.get(month)!;
    if (m.revenue_category === 'recurring') {
      entry.recurring = m.amount_net_month;
    } else {
      entry.non_recurring = m.amount_net_month;
    }
  });

  // Ordenar por fecha y generar serie completa
  const allMonths = Array.from(monthlyMap.keys()).sort();
  const startDate = new Date(allMonths[0]);
  const endDate = new Date(allMonths[allMonths.length - 1]);
  const fullMonthRange = generateMonthRange(startDate, endDate);

  const years = new Set(fullMonthRange.map(m => new Date(m).getFullYear()));
  const hasMultipleYears = years.size > 1;

  return fullMonthRange.map(monthKey => {
    const data = monthlyMap.get(monthKey) || { recurring: 0, non_recurring: 0 };
    return {
      monthKey,
      month: formatMonthLabel(monthKey, hasMultipleYears),
      recurring: data.recurring,
      non_recurring: data.non_recurring,
      total: data.recurring + data.non_recurring,
    };
  });
}

export function formatMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
}

// ============================================
// Contratos
// ============================================

export async function getContracts(): Promise<Contract[]> {
  const response = await fetch(`${BASE_URL}/data/contracts.json`);
  return response.json();
}

export async function getContractEvents(): Promise<ContractEvent[]> {
  const response = await fetch(`${BASE_URL}/data/contract_events.json`);
  return response.json();
}

// ============================================
// CashFlow - Gastos y Balance
// ============================================

export async function getExpenses(): Promise<Expense[]> {
  const data = await fetchCSV<Expense>('expenses.csv');
  // Normalizar subcategorías para homogenizar nomenclatura
  return data.map(expense => ({
    ...expense,
    subcategory: normalizeExpenseSubcategory(expense.subcategory),
  }));
}

export async function getCashBalance(): Promise<CashBalance> {
  const response = await fetch(`${BASE_URL}/data/cash_balance.json`);
  return response.json();
}

export async function getInflows(): Promise<BankInflow[]> {
  return fetchCSV<BankInflow>('inflows.csv');
}

// ============================================
// Financiación (Equity, Debt, Grants)
// ============================================

export async function getFinancing(): Promise<FinancingData> {
  const response = await fetch(`${BASE_URL}/data/financing.json`);
  return response.json();
}

export async function getUsageMetrics(): Promise<UsageMetrics | null> {
  try {
    const response = await fetch(`${BASE_URL}/data/usage_metrics.json`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-ES').format(Math.round(num));
}

export function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

// ============================================
// Filtrado por rango de fechas
// ============================================

/**
 * Filtra un array de datos por un campo de fecha dentro del rango especificado.
 * Si dateRange.startDate o endDate son null, no se aplica ese límite.
 */
export function filterByDate<T>(
  data: T[],
  dateField: keyof T,
  dateRange: DateRange
): T[] {
  const { startDate, endDate } = dateRange;

  // Sin filtro si ambos son null
  if (!startDate && !endDate) {
    return data;
  }

  return data.filter(item => {
    const fieldValue = item[dateField];

    // Si el campo es null o undefined, excluir del resultado filtrado
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    const itemDate = new Date(fieldValue as string);

    // Verificar si es una fecha válida
    if (isNaN(itemDate.getTime())) {
      return false;
    }

    if (startDate && itemDate < startDate) {
      return false;
    }

    if (endDate && itemDate > endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Filtra facturas por fecha de devengo (invoice_date)
 */
export function filterInvoicesByDevengo(invoices: Invoice[], dateRange: DateRange): Invoice[] {
  return filterByDate(invoices, 'invoice_date', dateRange);
}

/**
 * Filtra facturas por fecha de cobro (payment_date)
 * Solo incluye facturas que tienen payment_date
 */
export function filterInvoicesByCobro(invoices: Invoice[], dateRange: DateRange): Invoice[] {
  // Primero filtrar solo las que tienen payment_date
  const withPayment = invoices.filter(inv => inv.payment_date !== null);
  return filterByDate(withPayment, 'payment_date', dateRange);
}

/**
 * Filtra métricas MRR por mes
 */
export function filterMRRByDate(mrrData: MRRMetric[], dateRange: DateRange): MRRMetric[] {
  return filterByDate(mrrData, 'month', dateRange);
}

// ============================================
// Helpers para gráficos con series temporales
// ============================================

/**
 * Genera una lista de todos los meses entre dos fechas (inclusive)
 * Retorna array de strings en formato YYYY-MM-01
 */
export function generateMonthRange(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}-01`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Formatea el label del mes según si hay uno o varios años en los datos
 * - Si todos los datos son del mismo año: "Ene", "Feb", "Mar"
 * - Si hay varios años: "Ene 24", "Feb 24", "Mar 25"
 */
export function formatMonthLabel(dateStr: string, hasMultipleYears: boolean): string {
  const date = new Date(dateStr);
  const monthName = date.toLocaleDateString('es-ES', { month: 'short' });
  // Capitalizar primera letra
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  if (hasMultipleYears) {
    const year = date.getFullYear().toString().slice(-2);
    return `${capitalizedMonth} ${year}`;
  }

  return capitalizedMonth;
}

/**
 * Genera datos de gráfico con serie temporal completa (sin saltos)
 * Incluye meses sin datos con valor 0
 */
export function generateMonthlyChartData(invoices: Invoice[]): ChartDataPoint[] {
  if (invoices.length === 0) {
    return [];
  }

  // Agrupar por mes
  const monthlyMap = new Map<string, { recurring: number; non_recurring: number }>();

  invoices.forEach(inv => {
    const month = inv.invoice_month_start;
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { recurring: 0, non_recurring: 0 });
    }
    const entry = monthlyMap.get(month)!;
    if (inv.revenue_category === 'recurring') {
      entry.recurring += inv.amount_net;
    } else {
      entry.non_recurring += inv.amount_net;
    }
  });

  // Encontrar rango de fechas
  const allMonths = Array.from(monthlyMap.keys()).sort();
  const startDate = new Date(allMonths[0]);
  const endDate = new Date(allMonths[allMonths.length - 1]);

  // Generar todos los meses del rango
  const fullMonthRange = generateMonthRange(startDate, endDate);

  // Detectar si hay múltiples años
  const years = new Set(fullMonthRange.map(m => new Date(m).getFullYear()));
  const hasMultipleYears = years.size > 1;

  // Construir array con todos los meses (incluyendo vacíos)
  return fullMonthRange.map(monthKey => {
    const data = monthlyMap.get(monthKey) || { recurring: 0, non_recurring: 0 };
    return {
      monthKey,
      month: formatMonthLabel(monthKey, hasMultipleYears),
      recurring: data.recurring,
      non_recurring: data.non_recurring,
      total: data.recurring + data.non_recurring,
    };
  });
}

// ============================================
// Datos de facturación de clientes
// ============================================

export async function getBillingClients(): Promise<Record<string, BillingClient>> {
  const response = await fetch(`${BASE_URL}/data/billing_clients.json`);
  const data = await response.json();
  return data.clients;
}
