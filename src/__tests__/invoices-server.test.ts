import { describe, it, expect } from 'vitest';
import {
  validateCreateInput,
  validateEditInput,
  enrichInvoice,
  updateInvoice,
} from '@/lib/invoices-server';
import { InvoiceCreateInput, Invoice } from '@/types';

// ============================================
// Validación: Create
// ============================================

describe('validateCreateInput', () => {
  const validInput: InvoiceCreateInput = {
    invoice_id: 'FACT012026',
    invoice_date: '2026-01-15',
    customer_name: 'SAM',
    invoice_concept: 'Licencia Enero 2026',
    revenue_type: 'Licencia',
    amount_net: 5000,
    amount_total: 6050,
    status: 'pending',
    payment_date: null,
  };

  it('no errors for valid input', () => {
    const errors = validateCreateInput(validInput);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires invoice_id', () => {
    const errors = validateCreateInput({ ...validInput, invoice_id: '' });
    expect(errors.invoice_id).toBeDefined();
  });

  it('requires invoice_date', () => {
    const errors = validateCreateInput({ ...validInput, invoice_date: '' });
    expect(errors.invoice_date).toBeDefined();
  });

  it('rejects invalid date format', () => {
    const errors = validateCreateInput({ ...validInput, invoice_date: '15-01-2026' });
    expect(errors.invoice_date).toBeDefined();
  });

  it('rejects impossible dates like Feb 30', () => {
    const errors = validateCreateInput({ ...validInput, invoice_date: '2026-02-30' });
    expect(errors.invoice_date).toBeDefined();
  });

  it('rejects month 13', () => {
    const errors = validateCreateInput({ ...validInput, invoice_date: '2026-13-01' });
    expect(errors.invoice_date).toBeDefined();
  });

  it('requires customer_name', () => {
    const errors = validateCreateInput({ ...validInput, customer_name: '' });
    expect(errors.customer_name).toBeDefined();
  });

  it('requires amount_net > 0', () => {
    const errors = validateCreateInput({ ...validInput, amount_net: 0 });
    expect(errors.amount_net).toBeDefined();
  });

  it('rejects amount_total < amount_net', () => {
    const errors = validateCreateInput({ ...validInput, amount_net: 100, amount_total: 50 });
    expect(errors.amount_total).toBeDefined();
  });

  it('requires payment_date when status is paid', () => {
    const errors = validateCreateInput({ ...validInput, status: 'paid', payment_date: null });
    expect(errors.payment_date).toBeDefined();
  });

  it('valid when status=paid with payment_date', () => {
    const errors = validateCreateInput({
      ...validInput,
      status: 'paid',
      payment_date: '2026-01-20',
    });
    expect(errors.payment_date).toBeUndefined();
  });

  it('rejects invalid payment_date', () => {
    const errors = validateCreateInput({
      ...validInput,
      status: 'paid',
      payment_date: '2026-02-29', // 2026 is not leap year
    });
    expect(errors.payment_date).toBeDefined();
  });
});

// ============================================
// Validación: Edit
// ============================================

describe('validateEditInput', () => {
  it('accepts partial valid edit input', () => {
    const errors = validateEditInput({
      customer_name: 'SAM',
      status: 'pending',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('rejects empty customer_name', () => {
    const errors = validateEditInput({
      customer_name: '  ',
      status: 'pending',
    });
    expect(errors.customer_name).toBeDefined();
  });

  it('rejects invalid date in edit', () => {
    const errors = validateEditInput({
      invoice_date: '2026-00-15',
      status: 'pending',
    });
    expect(errors.invoice_date).toBeDefined();
  });
});

// ============================================
// Enrichment
// ============================================

describe('enrichInvoice', () => {
  const baseInput: InvoiceCreateInput = {
    invoice_id: 'FACT012026',
    invoice_date: '2026-02-15',
    customer_name: 'SAM',
    invoice_concept: 'Licencia Febrero 2026',
    revenue_type: 'Licencia',
    amount_net: 5000,
    amount_total: 6050,
    status: 'paid',
    payment_date: '2026-02-20',
  };

  it('calculates invoice_year, invoice_month correctly', () => {
    const result = enrichInvoice(baseInput);
    expect(result.invoice_year).toBe(2026);
    expect(result.invoice_month).toBe(2);
  });

  it('calculates invoice_month_start as YYYY-MM-01', () => {
    const result = enrichInvoice(baseInput);
    expect(result.invoice_month_start).toBe('2026-02-01');
  });

  it('calculates quarter correctly', () => {
    const result = enrichInvoice(baseInput);
    expect(result.invoice_quarter).toBe('2026Q1');

    const q2 = enrichInvoice({ ...baseInput, invoice_date: '2026-04-15' });
    expect(q2.invoice_quarter).toBe('2026Q2');

    const q4 = enrichInvoice({ ...baseInput, invoice_date: '2026-12-01' });
    expect(q4.invoice_quarter).toBe('2026Q4');
  });

  it('calculates payment fields when paid', () => {
    const result = enrichInvoice(baseInput);
    expect(result.payment_year).toBe(2026);
    expect(result.payment_month).toBe(2);
    expect(result.days_to_pay).toBe(5);
  });

  it('payment fields are null when pending', () => {
    const result = enrichInvoice({
      ...baseInput,
      status: 'pending',
      payment_date: null,
    });
    expect(result.payment_year).toBeNull();
    expect(result.payment_month).toBeNull();
    expect(result.days_to_pay).toBeNull();
  });

  it('classifies Licencia as recurring', () => {
    const result = enrichInvoice(baseInput);
    expect(result.revenue_category).toBe('recurring');
    expect(result.is_recurring).toBe(true);
  });

  it('classifies SetUp as non_recurring', () => {
    const result = enrichInvoice({ ...baseInput, revenue_type: 'SetUp' });
    expect(result.revenue_category).toBe('non_recurring');
    expect(result.is_recurring).toBe(false);
  });

  it('calculates tax correctly with rounding', () => {
    const result = enrichInvoice(baseInput);
    // 6050 - 5000 = 1050
    expect(result.amount_tax).toBe(1050);
    // 1050 / 5000 = 0.21
    expect(result.tax_rate_implied).toBe(0.21);
  });

  it('avoids floating point issues in tax calculation', () => {
    const result = enrichInvoice({
      ...baseInput,
      amount_net: 99.99,
      amount_total: 120.99,
    });
    // 120.99 - 99.99 = 21.00 (not 20.999...98)
    expect(result.amount_tax).toBe(21);
  });
});

// ============================================
// Update Invoice
// ============================================

describe('updateInvoice', () => {
  const existingInvoice: Invoice = {
    invoice_id: 'FACT012026',
    invoice_date: '2026-01-15',
    customer_name: 'SAM',
    invoice_concept: 'Licencia Enero 2026',
    revenue_type: 'Licencia',
    amount_net: 5000,
    amount_total: 6050,
    status: 'pending',
    payment_date: null,
    invoice_year: 2026,
    invoice_month: 1,
    invoice_month_start: '2026-01-01',
    invoice_quarter: '2026Q1',
    payment_year: null,
    payment_month: null,
    payment_month_start: null,
    days_to_pay: null,
    revenue_type_normalized: 'licencia',
    revenue_category: 'recurring',
    is_recurring: true,
    amount_tax: 1050,
    tax_rate_implied: 0.21,
    currency: 'EUR',
    exchange_rate: 1,
    amount_net_original: 5000,
    amount_total_original: 6050,
  };

  it('updates status to paid and recalculates payment fields', () => {
    const result = updateInvoice(existingInvoice, {
      status: 'paid',
      payment_date: '2026-01-25',
    });
    expect(result.status).toBe('paid');
    expect(result.payment_year).toBe(2026);
    expect(result.payment_month).toBe(1);
    expect(result.days_to_pay).toBe(10);
  });

  it('preserves unchanged fields', () => {
    const result = updateInvoice(existingInvoice, {
      status: 'pending',
    });
    expect(result.customer_name).toBe('SAM');
    expect(result.amount_net).toBe(5000);
    expect(result.invoice_id).toBe('FACT012026');
  });

  it('recalculates derived fields when amount changes', () => {
    const result = updateInvoice(existingInvoice, {
      amount_net: 10000,
      amount_total: 12100,
      status: 'pending',
    });
    expect(result.amount_tax).toBe(2100);
    expect(result.tax_rate_implied).toBe(0.21);
  });
});
