import { describe, it, expect } from 'vitest';
import { calculateForecast } from '@/lib/forecast';
import { Contract, Invoice } from '@/types';

// ============================================
// Test data
// ============================================

const mockContracts: Contract[] = [
  {
    client_id: 'SAM',
    client_name: 'Santander Asset Management',
    product: 'GPTadvisor Platform',
    current_mrr: 5000,
    status: 'activo',
    start_date: '2024-01-01',
    end_date: '2026-12-31',
    billing_frequency: 'mensual',
    notes: '',
  },
  {
    client_id: 'AIV',
    client_name: 'Andbank Investment Vehicles',
    product: 'GPTadvisor Platform',
    current_mrr: 6000,
    status: 'activo',
    start_date: '2024-06-01',
    end_date: '2026-06-30',
    billing_frequency: 'trimestral',
    notes: '',
  },
  {
    client_id: 'CKB',
    client_name: 'CKB Test',
    product: 'Test',
    current_mrr: 1000,
    status: 'activo',
    start_date: '2025-01-01',
    end_date: '2026-12-31',
    billing_frequency: 'mensual',
    notes: '',
  },
  {
    client_id: 'OLD',
    client_name: 'Old Client',
    product: 'Legacy',
    current_mrr: 2000,
    status: 'cancelado',
    start_date: '2023-01-01',
    end_date: '2024-12-31',
    billing_frequency: 'mensual',
    notes: '',
  },
];

const mockInvoices: Invoice[] = [
  {
    invoice_id: 'FACT012026',
    invoice_date: '2026-01-15',
    customer_name: 'SAM',
    invoice_concept: 'Licencia Enero 2026',
    revenue_type: 'Licencia',
    amount_net: 5500,
    amount_total: 6655,
    status: 'paid',
    payment_date: '2026-01-20',
    invoice_year: 2026,
    invoice_month: 1,
    invoice_month_start: '2026-01-01',
    invoice_quarter: '2026Q1',
    payment_year: 2026,
    payment_month: 1,
    payment_month_start: '2026-01-01',
    days_to_pay: 5,
    revenue_type_normalized: 'licencia',
    revenue_category: 'recurring',
    is_recurring: true,
    amount_tax: 1155,
    tax_rate_implied: 0.21,
    currency: 'EUR',
    exchange_rate: 1,
    amount_net_original: 5500,
    amount_total_original: 6655,
  },
  {
    invoice_id: 'FACT022026',
    invoice_date: '2026-01-15',
    customer_name: 'AIV',
    invoice_concept: 'Licencia Q1 2026',
    revenue_type: 'Licencia',
    amount_net: 18000, // trimestral
    amount_total: 21780,
    status: 'paid',
    payment_date: '2026-01-25',
    invoice_year: 2026,
    invoice_month: 1,
    invoice_month_start: '2026-01-01',
    invoice_quarter: '2026Q1',
    payment_year: 2026,
    payment_month: 1,
    payment_month_start: '2026-01-01',
    days_to_pay: 10,
    revenue_type_normalized: 'licencia',
    revenue_category: 'recurring',
    is_recurring: true,
    amount_tax: 3780,
    tax_rate_implied: 0.21,
    currency: 'EUR',
    exchange_rate: 1,
    amount_net_original: 18000,
    amount_total_original: 21780,
  },
  {
    invoice_id: 'FACT032026',
    invoice_date: '2026-02-01',
    customer_name: 'SAM',
    invoice_concept: 'SetUp módulo extra',
    revenue_type: 'SetUp',
    amount_net: 10000,
    amount_total: 12100,
    status: 'pending',
    payment_date: null,
    invoice_year: 2026,
    invoice_month: 2,
    invoice_month_start: '2026-02-01',
    invoice_quarter: '2026Q1',
    payment_year: null,
    payment_month: null,
    payment_month_start: null,
    days_to_pay: null,
    revenue_type_normalized: 'setup',
    revenue_category: 'non_recurring',
    is_recurring: false,
    amount_tax: 2100,
    tax_rate_implied: 0.21,
    currency: 'EUR',
    exchange_rate: 1,
    amount_net_original: 10000,
    amount_total_original: 12100,
  },
];

// ============================================
// Forecast
// ============================================

describe('calculateForecast', () => {
  const refDate = new Date(2026, 2, 1); // March 2026

  it('excludes cancelled contracts', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const clientIds = result.clients.map(c => c.clientId);
    expect(clientIds).not.toContain('OLD');
  });

  it('excludes CKB from forecast', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const clientIds = result.clients.map(c => c.clientId);
    expect(clientIds).not.toContain('CKB');
  });

  it('includes active contracts SAM and AIV', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const clientIds = result.clients.map(c => c.clientId);
    expect(clientIds).toContain('SAM');
    expect(clientIds).toContain('AIV');
  });

  it('uses invoice amount for SAM (mensual → MRR = invoice amount)', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const sam = result.clients.find(c => c.clientId === 'SAM');
    expect(sam?.mrrEstimado).toBe(5500); // Latest invoice amount
    expect(sam?.source).toBe('factura');
  });

  it('normalizes trimestral billing (AIV: 18000/3 = 6000 MRR)', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const aiv = result.clients.find(c => c.clientId === 'AIV');
    expect(aiv?.mrrEstimado).toBe(6000); // 18000 / 3
    expect(aiv?.source).toBe('factura');
  });

  it('calculates totalMRR correctly', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    // SAM: 5500 + AIV: 6000 = 11500
    expect(result.totalMRR).toBe(11500);
  });

  it('calculates forecast horizons correctly', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    expect(result.forecastM1).toBe(result.totalMRR);
    expect(result.forecastM3).toBe(result.totalMRR * 3);
    expect(result.forecastM6).toBe(result.totalMRR * 6);
    expect(result.forecastM12).toBe(result.totalMRR * 12);
  });

  it('calculates YTD from Licencia invoices of current year', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    // FACT01 (SAM 5500) + FACT02 (AIV 18000) = 23500 (SetUp excluded)
    expect(result.facturadoYTD).toBe(23500);
  });

  it('calculates mesesRestantesFY correctly', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    // March (month 2 in 0-indexed) → 12 - 2 = 10 months remaining
    expect(result.mesesRestantesFY).toBe(10);
  });

  it('percentages sum to ~100 for clients', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    const totalPct = result.clients.reduce((sum, c) => sum + c.percentOfTotal, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it('sorts clients by MRR descending', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    for (let i = 1; i < result.clients.length; i++) {
      expect(result.clients[i].mrrEstimado).toBeLessThanOrEqual(
        result.clients[i - 1].mrrEstimado
      );
    }
  });

  it('uses contract MRR when no invoices exist', () => {
    // Create a contract without any matching invoices
    const contractsWithFDP: Contract[] = [
      ...mockContracts,
      {
        client_id: 'FDP',
        client_name: 'FundsPeople',
        product: 'GPTadvisor Lite',
        current_mrr: 3000,
        status: 'activo',
        start_date: '2026-02-01',
        end_date: '2027-01-31',
        billing_frequency: 'mensual',
        notes: '',
      },
    ];

    const result = calculateForecast(contractsWithFDP, mockInvoices, refDate);
    const fdp = result.clients.find(c => c.clientId === 'FDP');
    expect(fdp?.mrrEstimado).toBe(3000);
    expect(fdp?.source).toBe('contrato');
  });

  it('ignores SetUp invoices (only uses Licencia)', () => {
    const result = calculateForecast(mockContracts, mockInvoices, refDate);
    // SetUp FACT03 (10000) should NOT be part of any client's MRR
    const sam = result.clients.find(c => c.clientId === 'SAM');
    expect(sam?.lastInvoiceAmount).toBe(5500); // Latest Licencia, not SetUp
  });
});
