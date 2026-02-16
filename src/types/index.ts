export interface Invoice {
  invoice_id: string;
  invoice_date: string;
  customer_name: string;
  invoice_concept: string;
  revenue_type: string;
  amount_net: number;
  amount_total: number;
  status: 'paid' | 'pending' | 'issued';
  payment_date: string | null;
  invoice_year: number;
  invoice_month: number;
  invoice_month_start: string;
  invoice_quarter: string;
  payment_year: number | null;
  payment_month: number | null;
  payment_month_start: string | null;
  days_to_pay: number | null;
  revenue_type_normalized: string;
  revenue_category: 'recurring' | 'non_recurring' | 'other';
  is_recurring: boolean;
  amount_tax: number;
  tax_rate_implied: number;
}

export interface MonthlyMetric {
  invoice_month_start: string;
  revenue_category: 'recurring' | 'non_recurring';
  amount_net_month: number;
  amount_net_cumulative: number;
}

export interface MRRMetric {
  month: string;
  mrr_approx: number;
  arr_approx: number;
}

export interface KPIData {
  totalRevenue: number;
  recurringRevenue: number;
  nonRecurringRevenue: number;
  currentMRR: number;
  currentARR: number;
  recurringPercentage: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  uniqueCustomers: number;
}

export interface ChartDataPoint {
  month: string;        // Label formateado para mostrar (Ene, Feb, Ene 24...)
  monthKey: string;     // Fecha ISO para ordenar (YYYY-MM-01)
  recurring: number;
  non_recurring: number;
  total: number;
}

// Contratos - estado actual (snapshot)
export interface Contract {
  client_id: string;
  client_name: string;
  contract_id: string;
  status: 'activo' | 'inactivo' | 'negociación';
  product: string;
  start_date: string;
  end_date: string | null;
  billing_frequency: string | null;
  currency: string;
  set_up: number;
  base_contract_value_annual: number;
  base_mrr_eur: number;
  base_arr_eur: number;
  renewal_type: string | null;
  notice_days: number | null;
  ipc_applicable: boolean;
  ipc_frequency: string | null;
  ipc_application_month: string | null;
  current_price_annual: number;
  current_mrr: number;
  account_owner: string;
}

// Eventos contractuales - histórico de cambios
export interface ContractEvent {
  event_id: string;
  contract_id: string;
  client_name: string;
  event_date: string;
  event_type: 'EXPANSION' | 'CANCELACIÓN' | 'DOWNGRADE' | 'NEW_BUSINESS';
  arr_delta: number;
  mrr_delta: number;
  currency: string;
  reason: string;
  effective_from: string;
  notes: string | null;
}

// ============================================
// Tipos para formularios de facturas
// ============================================

// Valores permitidos (enums del dataset)
export const INVOICE_STATUS = ['paid', 'pending'] as const;
export type InvoiceStatus = typeof INVOICE_STATUS[number];

export const REVENUE_TYPES = ['SetUp', 'Licencia'] as const;
export type RevenueType = typeof REVENUE_TYPES[number];

// Input para crear factura (solo campos base del Excel)
export interface InvoiceCreateInput {
  invoice_id: string;
  invoice_date: string;        // YYYY-MM-DD
  customer_name: string;
  invoice_concept: string;
  revenue_type: RevenueType;
  amount_net: number;
  amount_total: number;
  status: InvoiceStatus;
  payment_date: string | null; // YYYY-MM-DD o null
}

// Input para editar factura (todos los campos editables)
export interface InvoiceEditInput {
  invoice_id?: string;
  invoice_date?: string;        // YYYY-MM-DD
  customer_name?: string;
  invoice_concept?: string;
  revenue_type?: RevenueType;
  amount_net?: number;
  amount_total?: number;
  status: InvoiceStatus;
  payment_date: string | null;
}

// Errores de validación
export interface InvoiceValidationErrors {
  invoice_id?: string;
  invoice_date?: string;
  customer_name?: string;
  invoice_concept?: string;
  revenue_type?: string;
  amount_net?: string;
  amount_total?: string;
  status?: string;
  payment_date?: string;
}

// ============================================
// Tipos para Forecast
// ============================================

// Frecuencia de facturación
export type BillingFrequency = 'mensual' | 'trimestral' | 'anual';

// Cliente incluido en el forecast
export interface ForecastClient {
  clientId: string;
  clientName: string;
  contractName: string;
  billingFrequency: BillingFrequency;
  lastInvoiceDate: string | null;
  lastInvoiceAmount: number;        // amount_net de última factura (o MRR contractual si no hay)
  mrrEstimado: number;              // MRR normalizado (mensual)
  percentOfTotal: number;           // % sobre el MRR total
  forecastFY: number;               // Estimación para el resto del FY
  source: 'factura' | 'contrato';   // De dónde viene el MRR
}

// Resultado del cálculo de forecast
export interface ForecastData {
  // Fecha de cálculo
  calculatedAt: string;
  fiscalYear: number;

  // MRR total estimado
  totalMRR: number;

  // Horizontes
  forecastM1: number;
  forecastM3: number;
  forecastM6: number;
  forecastM12: number;

  // Vista FY
  mesesRestantesFY: number;
  facturadoYTD: number;             // Ya facturado en el FY actual (Licencia)
  forecastRestanteFY: number;       // Estimación resto del FY
  totalEstimadoFY: number;          // facturadoYTD + forecastRestanteFY

  // Detalle por cliente
  clients: ForecastClient[];
}

// ============================================
// Tipos para CashFlow
// ============================================

// Categorías de gastos
export const EXPENSE_CATEGORIES = [
  'Salarios',
  'Outsourcing',
  'Profesionales',
  'Marketing',
  'Operaciones',
  'Impuestos',
  'Financiación'
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Gasto individual
export interface Expense {
  expense_id: string;
  expense_date: string;        // YYYY-MM-DD
  category: ExpenseCategory;
  subcategory: string;
  amount: number;              // Negativo (gasto)
  description: string;
}

// Balance de caja
export interface CashBalanceHistory {
  month: string;               // YYYY-MM
  balance: number;
  notes?: string;
}

export interface CashBalance {
  current_balance: number;
  last_updated: string;        // YYYY-MM-DD
  history: CashBalanceHistory[];
}

// Métricas de CashFlow calculadas
export interface CashflowMetrics {
  // Balance actual
  currentCash: number;
  lastUpdated: string;

  // Burn rate (últimos N meses)
  burnRate: number;            // Promedio mensual de gastos operativos
  burnRatePeriod: number;      // Meses usados para calcular

  // Inflows
  avgMonthlyInflow: number;    // Promedio mensual de cobros

  // Net burn
  netBurn: number;             // burnRate - avgMonthlyInflow (positivo = quemando caja)

  // Runway
  runwayMonths: number;        // Meses restantes
  runwayEndDate: string;       // Fecha estimada de fin de caja

  // Breakdown por categoría
  expensesByCategory: {
    category: ExpenseCategory;
    total: number;
    percentage: number;
  }[];
}

// Punto de datos para gráfico de proyección
export interface CashProjectionPoint {
  month: string;               // YYYY-MM
  monthLabel: string;          // "Ene 26"
  projected: number;           // Caja proyectada
  isHistorical: boolean;       // true si es dato real, false si es proyección
}

// Punto de datos para gráfico inflows vs outflows
export interface CashflowChartPoint {
  month: string;
  monthLabel: string;
  inflow: number;
  outflow: number;
  net: number;
}

// Inflow bancario (entrada de dinero real del banco)
export interface BankInflow {
  inflow_id: string;
  inflow_date: string;        // YYYY-MM-DD
  category: string;           // Tipo de ingreso (Licencia, SetUp, Consultoría, etc.)
  amount: number;             // Positivo
  description: string;
}

// ============================================
// Tipos para Financiación (Equity, Debt, Grants)
// ============================================

export interface EquityRound {
  investor: string;
  amount: number;
  round: string;
  instrument: string;
  date: string;            // YYYY-MM-DD
}

export interface DebtInstrument {
  instrument: string;
  institution: string;
  amount: number;
  date: string;            // YYYY-MM-DD
}

export interface Grant {
  name: string;
  institution: string;
  amount: number;
  date: string;            // YYYY-MM-DD
}

export interface FinancingData {
  equity_rounds: EquityRound[];
  debt: DebtInstrument[];
  grants: Grant[];
}

// Usage Metrics (from GPTadvisor screenshots via OCR)
export interface UsageMetricsLatest {
  date: string;
  total_users: number | null;
  active_users: number | null;
  conversations: number | null;
  registered_users: number | null;
  organizations: number | null;
  multi_day_active_users_pct: number | null;
  avg_daily_conversations: number | null;
}

export interface UsageMetrics {
  last_updated: string;
  latest: UsageMetricsLatest;
  history: {
    date: string;
    total_users: number | null;
    active_users: number | null;
    conversations: number | null;
    avg_daily_conversations: number | null;
  }[];
}

// ============================================
// Tipos para Facturación (datos de cliente)
// ============================================

export interface BillingClient {
  fiscal_name: string;
  nif: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
}

// ============================================
// Tipos para Informe VC
// ============================================

export type VCPeriodType = 'year' | 'quarter';

export interface VCPeriod {
  type: VCPeriodType;
  year: number;
  quarter?: 1 | 2 | 3 | 4;
}
