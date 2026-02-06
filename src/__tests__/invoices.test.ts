import { describe, it, expect } from 'vitest';

// ============================================
// Tests para cálculo de IVA
// ============================================

const DEFAULT_VAT_RATE = 0.21;

/**
 * Calcula el importe total a partir del neto
 */
function calculateTotal(netAmount: number, withoutVat: boolean): number {
  if (isNaN(netAmount) || netAmount <= 0) {
    return 0;
  }
  const total = withoutVat ? netAmount : netAmount * (1 + DEFAULT_VAT_RATE);
  return Math.round(total * 100) / 100;
}

describe('Cálculo de IVA', () => {
  it('neto=100 => total=121 con IVA (21%)', () => {
    const total = calculateTotal(100, false);
    expect(total).toBe(121);
  });

  it('neto=100 => total=100 con "SIN IVA"', () => {
    const total = calculateTotal(100, true);
    expect(total).toBe(100);
  });

  it('neto=0 => total=0', () => {
    expect(calculateTotal(0, false)).toBe(0);
    expect(calculateTotal(0, true)).toBe(0);
  });

  it('neto negativo => total=0', () => {
    expect(calculateTotal(-100, false)).toBe(0);
    expect(calculateTotal(-100, true)).toBe(0);
  });

  it('redondea correctamente a 2 decimales', () => {
    // 99.99 * 1.21 = 120.9879 => 120.99
    const total = calculateTotal(99.99, false);
    expect(total).toBe(120.99);
  });

  it('importe grande con IVA', () => {
    const total = calculateTotal(10000, false);
    expect(total).toBe(12100);
  });

  it('importe con decimales sin IVA permanece igual', () => {
    const total = calculateTotal(123.45, true);
    expect(total).toBe(123.45);
  });
});

// ============================================
// Tests para ordenación de IDs de factura
// ============================================

/**
 * Parsea un ID de factura con formato FACT<correlativo><año>
 */
function parseInvoiceId(id: string): { year: number; correlative: number; valid: boolean } {
  const match = id.match(/^FACT(\d+)(\d{4})$/i);

  if (!match) {
    return { year: 0, correlative: 0, valid: false };
  }

  const correlative = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  return { year, correlative, valid: true };
}

/**
 * Comparador para ordenar facturas por ID
 */
function compareInvoiceIds(a: string, b: string, direction: 'asc' | 'desc'): number {
  const parsedA = parseInvoiceId(a);
  const parsedB = parseInvoiceId(b);

  if (!parsedA.valid && !parsedB.valid) return 0;
  if (!parsedA.valid) return 1;
  if (!parsedB.valid) return -1;

  if (parsedA.year !== parsedB.year) {
    const yearDiff = parsedA.year - parsedB.year;
    return direction === 'desc' ? -yearDiff : yearDiff;
  }

  const corrDiff = parsedA.correlative - parsedB.correlative;
  return direction === 'desc' ? -corrDiff : corrDiff;
}

describe('Parseo de ID de factura', () => {
  it('parsea correctamente FACT012025', () => {
    const result = parseInvoiceId('FACT012025');
    expect(result.valid).toBe(true);
    expect(result.year).toBe(2025);
    expect(result.correlative).toBe(1);
  });

  it('parsea correctamente FACT102024', () => {
    const result = parseInvoiceId('FACT102024');
    expect(result.valid).toBe(true);
    expect(result.year).toBe(2024);
    expect(result.correlative).toBe(10);
  });

  it('parsea correctamente FACT0012026 (con ceros a la izquierda)', () => {
    const result = parseInvoiceId('FACT0012026');
    expect(result.valid).toBe(true);
    expect(result.year).toBe(2026);
    expect(result.correlative).toBe(1);
  });

  it('parsea correctamente FACT1232023', () => {
    const result = parseInvoiceId('FACT1232023');
    expect(result.valid).toBe(true);
    expect(result.year).toBe(2023);
    expect(result.correlative).toBe(123);
  });

  it('ID inválido sin prefijo FACT', () => {
    const result = parseInvoiceId('INV012025');
    expect(result.valid).toBe(false);
  });

  it('ID inválido formato incorrecto', () => {
    const result = parseInvoiceId('FACT-01-2025');
    expect(result.valid).toBe(false);
  });

  it('ID inválido vacío', () => {
    const result = parseInvoiceId('');
    expect(result.valid).toBe(false);
  });
});

describe('Ordenación de facturas por ID', () => {
  it('FACT022026 debe ir antes que FACT012026 (mismo año, mayor correlativo primero en desc)', () => {
    const result = compareInvoiceIds('FACT022026', 'FACT012026', 'desc');
    expect(result).toBeLessThan(0); // negativo = a va antes que b
  });

  it('FACT012026 debe ir antes que FACT102025 (2026 > 2025 en desc)', () => {
    const result = compareInvoiceIds('FACT012026', 'FACT102025', 'desc');
    expect(result).toBeLessThan(0); // negativo = a va antes que b
  });

  it('FACT032026 debe ir antes que FACT022026 (mismo año, mayor correlativo primero en desc)', () => {
    const result = compareInvoiceIds('FACT032026', 'FACT022026', 'desc');
    expect(result).toBeLessThan(0);
  });

  it('ordenar lista completa descendente', () => {
    const ids = ['FACT012025', 'FACT022026', 'FACT102025', 'FACT012026', 'FACT032026'];
    const sorted = [...ids].sort((a, b) => compareInvoiceIds(a, b, 'desc'));

    // Esperado: primero 2026 (mayor correlativo primero), luego 2025 (mayor correlativo primero)
    expect(sorted).toEqual([
      'FACT032026', // 2026, correlativo 3
      'FACT022026', // 2026, correlativo 2
      'FACT012026', // 2026, correlativo 1
      'FACT102025', // 2025, correlativo 10
      'FACT012025', // 2025, correlativo 1
    ]);
  });

  it('ordenar lista completa ascendente', () => {
    const ids = ['FACT012025', 'FACT022026', 'FACT102025', 'FACT012026', 'FACT032026'];
    const sorted = [...ids].sort((a, b) => compareInvoiceIds(a, b, 'asc'));

    // Esperado: primero 2025 (menor correlativo primero), luego 2026 (menor correlativo primero)
    expect(sorted).toEqual([
      'FACT012025', // 2025, correlativo 1
      'FACT102025', // 2025, correlativo 10
      'FACT012026', // 2026, correlativo 1
      'FACT022026', // 2026, correlativo 2
      'FACT032026', // 2026, correlativo 3
    ]);
  });

  it('IDs inválidos van al final', () => {
    const ids = ['FACT012025', 'INVALID', 'FACT022025'];
    const sorted = [...ids].sort((a, b) => compareInvoiceIds(a, b, 'desc'));

    expect(sorted).toEqual([
      'FACT022025',
      'FACT012025',
      'INVALID',
    ]);
  });

  it('múltiples IDs inválidos mantienen orden relativo', () => {
    const ids = ['INVALID1', 'FACT012025', 'INVALID2'];
    const sorted = [...ids].sort((a, b) => compareInvoiceIds(a, b, 'desc'));

    expect(sorted[0]).toBe('FACT012025');
    // Los inválidos van al final (su orden relativo puede variar según el algoritmo de sort)
    expect(sorted.slice(1)).toContain('INVALID1');
    expect(sorted.slice(1)).toContain('INVALID2');
  });
});
