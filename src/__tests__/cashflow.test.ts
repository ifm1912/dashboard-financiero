import { describe, it, expect } from 'vitest';
import {
  calculateBurnRate,
  getMonthlyExpenses,
  getExpensesByCategory,
  calculateAvgMonthlyInflow,
  calculateNetBurn,
  calculateRunway,
  getRunwayEndDate,
  projectCashflow,
} from '@/lib/cashflow';
import { Expense, BankInflow } from '@/types';

// ============================================
// Test data
// ============================================

const mockExpenses: Expense[] = [
  { expense_id: 'EXP-0001', expense_date: '2026-01-05', category: 'Salarios', subcategory: 'Personal', amount: -15000, description: 'Nóminas Ene' },
  { expense_id: 'EXP-0002', expense_date: '2026-01-10', category: 'Operaciones', subcategory: 'Apps', amount: -2000, description: 'AWS Ene' },
  { expense_id: 'EXP-0003', expense_date: '2026-01-15', category: 'Financiación', subcategory: '', amount: -5000, description: 'Cuota ENISA' },
  { expense_id: 'EXP-0004', expense_date: '2026-02-05', category: 'Salarios', subcategory: 'Personal', amount: -16000, description: 'Nóminas Feb' },
  { expense_id: 'EXP-0005', expense_date: '2026-02-10', category: 'Operaciones', subcategory: 'Apps', amount: -2500, description: 'AWS Feb' },
  { expense_id: 'EXP-0006', expense_date: '2025-12-05', category: 'Salarios', subcategory: 'Personal', amount: -14000, description: 'Nóminas Dic' },
];

const mockInflows: BankInflow[] = [
  { inflow_id: 'INF-0001', inflow_date: '2026-01-15', category: 'Ingresos', amount: 25000, description: 'Cobro SAM' },
  { inflow_id: 'INF-0002', inflow_date: '2026-01-20', category: 'Ingresos', amount: 10000, description: 'Cobro AIV' },
  { inflow_id: 'INF-0003', inflow_date: '2026-02-10', category: 'Ingresos', amount: 30000, description: 'Cobro SAM Feb' },
  { inflow_id: 'INF-0004', inflow_date: '2026-02-15', category: 'ENISA', amount: 50000, description: 'Desembolso ENISA' },
];

// ============================================
// Burn Rate
// ============================================

describe('calculateBurnRate', () => {
  it('excludes Financiación from calculation', () => {
    const burnRate = calculateBurnRate(mockExpenses, 12);
    // Financiación (-5000) should be excluded
    // Ene: -15000 + -2000 = -17000
    // Feb: -16000 + -2500 = -18500
    // Dec: -14000
    // 3 months of data, avg = (-17000 + -18500 + -14000) / 3 = -16500
    expect(burnRate).toBeCloseTo(-16500, 0);
  });

  it('returns 0 for empty expenses', () => {
    expect(calculateBurnRate([], 6)).toBe(0);
  });

  it('respects months parameter', () => {
    // With months=2, should only use the 2 most recent months (Jan & Feb 2026)
    const burnRate = calculateBurnRate(mockExpenses, 2);
    // Feb: -18500, Jan: -17000 → avg = -17750
    expect(burnRate).toBeCloseTo(-17750, 0);
  });
});

// ============================================
// Monthly Expenses
// ============================================

describe('getMonthlyExpenses', () => {
  it('groups expenses by month', () => {
    const monthly = getMonthlyExpenses(mockExpenses);
    expect(monthly.length).toBeGreaterThanOrEqual(3);
  });

  it('sorts by month ascending', () => {
    const monthly = getMonthlyExpenses(mockExpenses);
    for (let i = 1; i < monthly.length; i++) {
      expect(monthly[i].month > monthly[i - 1].month).toBe(true);
    }
  });

  it('sums amounts per month', () => {
    const monthly = getMonthlyExpenses(mockExpenses);
    const jan = monthly.find(m => m.month === '2026-01');
    // Jan: -15000 + -2000 + -5000 = -22000 (includes financiación at this level)
    expect(jan?.total).toBe(-22000);
  });
});

// ============================================
// Expenses by Category
// ============================================

describe('getExpensesByCategory', () => {
  it('returns categories sorted by absolute value', () => {
    const categories = getExpensesByCategory(mockExpenses);
    for (let i = 1; i < categories.length; i++) {
      expect(Math.abs(categories[i].total)).toBeLessThanOrEqual(
        Math.abs(categories[i - 1].total)
      );
    }
  });

  it('calculates percentage correctly', () => {
    const categories = getExpensesByCategory(mockExpenses);
    const totalPct = categories.reduce((sum, c) => sum + c.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ============================================
// Bank Inflows
// ============================================

describe('calculateAvgMonthlyInflow', () => {
  it('excludes financing categories', () => {
    const avg = calculateAvgMonthlyInflow(mockInflows, 12);
    // Only operational: Jan 25000+10000=35000, Feb 30000
    // Avg = (35000 + 30000) / 2 = 32500
    expect(avg).toBeCloseTo(32500, 0);
  });

  it('returns 0 for empty inflows', () => {
    expect(calculateAvgMonthlyInflow([], 6)).toBe(0);
  });
});

// ============================================
// Net Burn & Runway
// ============================================

describe('calculateNetBurn', () => {
  it('positive when spending more than earning', () => {
    // burnRate = -20000 (spending), avgInflow = 10000 (earning)
    const netBurn = calculateNetBurn(-20000, 10000);
    expect(netBurn).toBe(10000); // Burning 10K/month net
  });

  it('negative when earning more than spending', () => {
    const netBurn = calculateNetBurn(-10000, 20000);
    expect(netBurn).toBe(-10000); // Generating 10K/month net
  });

  it('zero when breakeven', () => {
    const netBurn = calculateNetBurn(-15000, 15000);
    expect(netBurn).toBe(0);
  });
});

describe('calculateRunway', () => {
  it('calculates months of runway correctly', () => {
    const runway = calculateRunway(100000, 10000);
    expect(runway).toBe(10); // 100K / 10K per month = 10 months
  });

  it('returns Infinity when not burning cash', () => {
    const runway = calculateRunway(100000, -5000);
    expect(runway).toBe(Infinity);
  });

  it('returns Infinity when netBurn is 0', () => {
    const runway = calculateRunway(100000, 0);
    expect(runway).toBe(Infinity);
  });
});

describe('getRunwayEndDate', () => {
  it('returns Indefinido for infinite runway', () => {
    expect(getRunwayEndDate(Infinity)).toBe('Indefinido');
  });

  it('returns a valid date string for finite runway', () => {
    const result = getRunwayEndDate(6);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================
// Projections
// ============================================

describe('projectCashflow', () => {
  it('generates correct number of projection points', () => {
    const points = projectCashflow(500000, 20000, 6);
    // 6 projected months
    expect(points.filter(p => !p.isHistorical)).toHaveLength(6);
  });

  it('projected values decrease by netBurn each month', () => {
    const points = projectCashflow(100000, 10000, 3);
    const projected = points.filter(p => !p.isHistorical);
    expect(projected[0].projected).toBe(90000);
    expect(projected[1].projected).toBe(80000);
    expect(projected[2].projected).toBe(70000);
  });

  it('projected value never goes below 0', () => {
    const points = projectCashflow(15000, 10000, 5);
    const projected = points.filter(p => !p.isHistorical);
    // 15K - 10K = 5K, 5K - 10K = 0 (capped), then 0, 0, 0
    expect(projected[0].projected).toBe(5000);
    expect(projected[1].projected).toBe(0);
    expect(projected[2].projected).toBe(0);
  });

  it('includes historical data when provided', () => {
    const history = [
      { month: '2025-12', balance: 400000 },
      { month: '2026-01', balance: 500000 },
    ];
    const points = projectCashflow(500000, 20000, 3, history);
    const historical = points.filter(p => p.isHistorical);
    expect(historical).toHaveLength(2);
  });
});
