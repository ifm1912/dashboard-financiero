/**
 * Block definitions, preset mappings, and estimation utilities
 * for the modular PDF export system (Fase 2).
 */

export type ReportBlock =
  | 'REVENUE_PERFORMANCE'
  | 'RECURRING_METRICS'
  | 'REVENUE_CHART'
  | 'MRR_TREND'
  | 'CLIENTS_CONCENTRATION'
  | 'USAGE'
  | 'PIPELINE'
  | 'CASH_RUNWAY'
  | 'CASHFLOW_CHART'
  | 'EXPENSES'
  | 'FINANCING'
  | 'EFFICIENCY'
  | 'CONTRACTS'
  | 'FORECAST'
  | 'ALERTS';

// All blocks in canonical render order
export const ALL_BLOCKS: ReportBlock[] = [
  'REVENUE_PERFORMANCE',
  'RECURRING_METRICS',
  'REVENUE_CHART',
  'MRR_TREND',
  'EFFICIENCY',
  'FORECAST',
  'CLIENTS_CONCENTRATION',
  'USAGE',
  'PIPELINE',
  'CASH_RUNWAY',
  'CASHFLOW_CHART',
  'EXPENSES',
  'CONTRACTS',
  'ALERTS',
  'FINANCING',
];

// Presets: blocks included in each report type
export const PRESET_BLOCKS: Record<string, ReportBlock[]> = {
  investors: [
    'REVENUE_PERFORMANCE',
    'RECURRING_METRICS',
    'CLIENTS_CONCENTRATION',
    'USAGE',
    'PIPELINE',
    'CASH_RUNWAY',
    'FINANCING',
  ],
  management: [
    'REVENUE_PERFORMANCE',
    'RECURRING_METRICS',
    'REVENUE_CHART',
    'CLIENTS_CONCENTRATION',
    'USAGE',
    'CASH_RUNWAY',
    'CASHFLOW_CHART',
    'EXPENSES',
    'EFFICIENCY',
  ],
  full: [...ALL_BLOCKS],
};

// Approximate height (mm) for page estimation
export const BLOCK_HEIGHTS: Record<ReportBlock, number> = {
  REVENUE_PERFORMANCE: 35,
  RECURRING_METRICS: 35,
  REVENUE_CHART: 65,
  MRR_TREND: 65,
  CLIENTS_CONCENTRATION: 55,
  USAGE: 30,
  PIPELINE: 45,
  CASH_RUNWAY: 35,
  CASHFLOW_CHART: 65,
  EXPENSES: 55,
  FINANCING: 60,
  EFFICIENCY: 35,
  CONTRACTS: 70,
  FORECAST: 55,
  ALERTS: 40,
};

// Human-readable labels for the UI
export const BLOCK_LABELS: Record<ReportBlock, string> = {
  REVENUE_PERFORMANCE: 'Revenue Performance',
  RECURRING_METRICS: 'Recurring Metrics (ARR/MRR)',
  REVENUE_CHART: 'Revenue Chart (6M)',
  MRR_TREND: 'MRR/ARR Trend',
  CLIENTS_CONCENTRATION: 'Clients & Concentration',
  USAGE: 'Usage Metrics',
  PIPELINE: 'Pipeline ARR',
  CASH_RUNWAY: 'Cash & Runway',
  CASHFLOW_CHART: 'Cashflow Chart (6M)',
  EXPENSES: 'Expense Distribution',
  FINANCING: 'Financiación',
  EFFICIENCY: 'Operational Efficiency',
  CONTRACTS: 'Contracts Portfolio',
  FORECAST: 'Revenue Forecast',
  ALERTS: 'Alerts',
};

// Estimate pages from selected blocks
const PAGE_CONTENT_HEIGHT = 242; // A4 297mm - margins ~55mm

export function estimatePages(blocks: ReportBlock[]): number {
  const totalHeight = blocks.reduce((sum, b) => sum + BLOCK_HEIGHTS[b], 0);
  return Math.max(1, Math.ceil(totalHeight / PAGE_CONTENT_HEIGHT));
}
