/**
 * Utilidades del servidor para gestión de facturas
 * - Enriquecimiento de campos derivados
 * - Lectura/escritura CSV con backup y atomic write
 * - Validación estricta
 */

import { promises as fs } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import {
  Invoice,
  InvoiceCreateInput,
  InvoiceEditInput,
  InvoiceValidationErrors,
  INVOICE_STATUS,
  REVENUE_TYPES,
} from '@/types';

// Ruta al CSV de facturas
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const CSV_FILE = path.join(DATA_DIR, 'facturas_historicas_enriquecido.csv');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Header exacto del CSV (orden de columnas)
const CSV_HEADERS = [
  'invoice_id',
  'invoice_date',
  'customer_name',
  'invoice_concept',
  'revenue_type',
  'amount_net',
  'amount_total',
  'status',
  'payment_date',
  'invoice_year',
  'invoice_month',
  'invoice_month_start',
  'invoice_quarter',
  'payment_year',
  'payment_month',
  'payment_month_start',
  'days_to_pay',
  'revenue_type_normalized',
  'revenue_category',
  'is_recurring',
  'amount_tax',
  'tax_rate_implied',
];

// Lock simple para evitar escrituras concurrentes
let writeLock = false;

// ============================================
// Validación
// ============================================

export function validateCreateInput(input: InvoiceCreateInput): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};

  // invoice_id obligatorio y formato
  if (!input.invoice_id || input.invoice_id.trim() === '') {
    errors.invoice_id = 'El ID de factura es obligatorio';
  }

  // invoice_date obligatorio y formato YYYY-MM-DD
  if (!input.invoice_date) {
    errors.invoice_date = 'La fecha es obligatoria';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.invoice_date)) {
    errors.invoice_date = 'Formato de fecha inválido (usar YYYY-MM-DD)';
  }

  // customer_name obligatorio
  if (!input.customer_name || input.customer_name.trim() === '') {
    errors.customer_name = 'El cliente es obligatorio';
  }

  // invoice_concept obligatorio
  if (!input.invoice_concept || input.invoice_concept.trim() === '') {
    errors.invoice_concept = 'El concepto es obligatorio';
  }

  // revenue_type debe ser uno de los permitidos
  if (!REVENUE_TYPES.includes(input.revenue_type as typeof REVENUE_TYPES[number])) {
    errors.revenue_type = `Tipo debe ser: ${REVENUE_TYPES.join(' o ')}`;
  }

  // amount_net > 0
  if (typeof input.amount_net !== 'number' || input.amount_net <= 0) {
    errors.amount_net = 'El importe neto debe ser mayor que 0';
  }

  // amount_total >= amount_net
  if (typeof input.amount_total !== 'number' || input.amount_total < input.amount_net) {
    errors.amount_total = 'El total no puede ser menor que el neto';
  }

  // status debe ser uno de los permitidos
  if (!INVOICE_STATUS.includes(input.status as typeof INVOICE_STATUS[number])) {
    errors.status = `Estado debe ser: ${INVOICE_STATUS.join(' o ')}`;
  }

  // Si status = paid, payment_date es obligatorio
  if (input.status === 'paid') {
    if (!input.payment_date) {
      errors.payment_date = 'La fecha de pago es obligatoria para facturas pagadas';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payment_date)) {
      errors.payment_date = 'Formato de fecha inválido (usar YYYY-MM-DD)';
    }
  }

  return errors;
}

export function validateEditInput(input: InvoiceEditInput): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};

  // invoice_date formato YYYY-MM-DD (si se proporciona)
  if (input.invoice_date !== undefined && input.invoice_date !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.invoice_date)) {
      errors.invoice_date = 'Formato de fecha inválido (usar YYYY-MM-DD)';
    }
  }

  // customer_name no puede estar vacío (si se proporciona)
  if (input.customer_name !== undefined && input.customer_name.trim() === '') {
    errors.customer_name = 'El cliente es obligatorio';
  }

  // invoice_concept no puede estar vacío (si se proporciona)
  if (input.invoice_concept !== undefined && input.invoice_concept.trim() === '') {
    errors.invoice_concept = 'El concepto es obligatorio';
  }

  // revenue_type debe ser uno de los permitidos (si se proporciona)
  // Comparación case-insensitive para mayor flexibilidad
  if (input.revenue_type !== undefined) {
    const normalizedType = input.revenue_type.toLowerCase();
    const validTypes = REVENUE_TYPES.map(t => t.toLowerCase());
    if (!validTypes.includes(normalizedType)) {
      errors.revenue_type = `Tipo debe ser: ${REVENUE_TYPES.join(' o ')}`;
    }
  }

  // amount_net > 0 (si se proporciona y no es undefined/null)
  if (input.amount_net !== undefined && input.amount_net !== null) {
    const netValue = Number(input.amount_net);
    if (isNaN(netValue) || netValue <= 0) {
      errors.amount_net = 'El importe neto debe ser mayor que 0';
    }
  }

  // amount_total >= amount_net (si ambos se proporcionan)
  if (input.amount_total !== undefined && input.amount_net !== undefined) {
    const totalValue = Number(input.amount_total);
    const netValue = Number(input.amount_net);
    if (!isNaN(totalValue) && !isNaN(netValue) && totalValue < netValue) {
      errors.amount_total = 'El total no puede ser menor que el neto';
    }
  }

  // status debe ser uno de los permitidos
  if (!INVOICE_STATUS.includes(input.status as typeof INVOICE_STATUS[number])) {
    errors.status = `Estado debe ser: ${INVOICE_STATUS.join(' o ')}`;
  }

  // Si status = paid, payment_date es obligatorio
  if (input.status === 'paid') {
    if (!input.payment_date) {
      errors.payment_date = 'La fecha de pago es obligatoria para facturas pagadas';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payment_date)) {
      errors.payment_date = 'Formato de fecha inválido (usar YYYY-MM-DD)';
    }
  }

  return errors;
}

// ============================================
// Enriquecimiento de campos derivados
// ============================================

/**
 * Calcula todos los campos derivados a partir de los 9 campos base
 * Usa UTC para evitar problemas de timezone
 */
export function enrichInvoice(input: InvoiceCreateInput): Invoice {
  // Parsear fecha de factura (UTC para evitar timezone bugs)
  const [year, month, day] = input.invoice_date.split('-').map(Number);
  const invoiceDate = new Date(Date.UTC(year, month - 1, day));

  // Campos derivados de invoice_date
  const invoice_year = invoiceDate.getUTCFullYear();
  const invoice_month = invoiceDate.getUTCMonth() + 1;
  const invoice_month_start = `${invoice_year}-${String(invoice_month).padStart(2, '0')}-01`;

  // Quarter: Q1 (1-3), Q2 (4-6), Q3 (7-9), Q4 (10-12)
  const quarter = Math.ceil(invoice_month / 3);
  const invoice_quarter = `${invoice_year}Q${quarter}`;

  // Campos de pago (solo si hay payment_date)
  let payment_year: number | null = null;
  let payment_month: number | null = null;
  let payment_month_start: string | null = null;
  let days_to_pay: number | null = null;

  if (input.payment_date) {
    const [pYear, pMonth, pDay] = input.payment_date.split('-').map(Number);
    const paymentDate = new Date(Date.UTC(pYear, pMonth - 1, pDay));

    payment_year = paymentDate.getUTCFullYear();
    payment_month = paymentDate.getUTCMonth() + 1;
    payment_month_start = `${payment_year}-${String(payment_month).padStart(2, '0')}-01`;

    // Días hasta el pago
    const diffTime = paymentDate.getTime() - invoiceDate.getTime();
    days_to_pay = Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // Campos derivados del revenue_type
  const revenue_type_normalized = input.revenue_type.toLowerCase();
  const revenue_category: 'recurring' | 'non_recurring' =
    input.revenue_type === 'Licencia' ? 'recurring' : 'non_recurring';
  const is_recurring = revenue_category === 'recurring';

  // Campos derivados de importes
  const amount_tax = input.amount_total - input.amount_net;
  const tax_rate_implied = input.amount_net > 0 ? amount_tax / input.amount_net : 0;

  return {
    invoice_id: input.invoice_id.trim(),
    invoice_date: input.invoice_date,
    customer_name: input.customer_name.trim(),
    invoice_concept: input.invoice_concept.trim(),
    revenue_type: input.revenue_type,
    amount_net: input.amount_net,
    amount_total: input.amount_total,
    status: input.status,
    payment_date: input.status === 'paid' ? input.payment_date : null,
    invoice_year,
    invoice_month,
    invoice_month_start,
    invoice_quarter,
    payment_year,
    payment_month,
    payment_month_start,
    days_to_pay,
    revenue_type_normalized,
    revenue_category,
    is_recurring,
    amount_tax,
    tax_rate_implied,
  };
}

/**
 * Actualiza una factura existente con todos los campos editables
 * Recalcula todos los campos derivados
 */
export function updateInvoice(invoice: Invoice, input: InvoiceEditInput): Invoice {
  // Actualizar campos base (mantener originales si no se proporcionan)
  const invoice_date = input.invoice_date ?? invoice.invoice_date;
  const customer_name = input.customer_name?.trim() ?? invoice.customer_name;
  const invoice_concept = input.invoice_concept?.trim() ?? invoice.invoice_concept;
  const revenue_type = input.revenue_type ?? invoice.revenue_type;
  const amount_net = input.amount_net ?? invoice.amount_net;
  const amount_total = input.amount_total ?? invoice.amount_total;
  const status = input.status;
  const payment_date = status === 'paid' ? input.payment_date : null;

  // Recalcular campos derivados de invoice_date
  const [year, month, day] = invoice_date.split('-').map(Number);
  const invoiceDateObj = new Date(Date.UTC(year, month - 1, day));

  const invoice_year = invoiceDateObj.getUTCFullYear();
  const invoice_month = invoiceDateObj.getUTCMonth() + 1;
  const invoice_month_start = `${invoice_year}-${String(invoice_month).padStart(2, '0')}-01`;

  const quarter = Math.ceil(invoice_month / 3);
  const invoice_quarter = `${invoice_year}Q${quarter}`;

  // Recalcular campos de pago
  let payment_year: number | null = null;
  let payment_month: number | null = null;
  let payment_month_start: string | null = null;
  let days_to_pay: number | null = null;

  if (payment_date) {
    const [pYear, pMonth, pDay] = payment_date.split('-').map(Number);
    const paymentDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay));

    payment_year = paymentDateObj.getUTCFullYear();
    payment_month = paymentDateObj.getUTCMonth() + 1;
    payment_month_start = `${payment_year}-${String(payment_month).padStart(2, '0')}-01`;

    const diffTime = paymentDateObj.getTime() - invoiceDateObj.getTime();
    days_to_pay = Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // Recalcular campos derivados de revenue_type
  const revenue_type_normalized = revenue_type.toLowerCase();
  const revenue_category: 'recurring' | 'non_recurring' =
    revenue_type === 'Licencia' ? 'recurring' : 'non_recurring';
  const is_recurring = revenue_category === 'recurring';

  // Recalcular campos derivados de importes
  const amount_tax = amount_total - amount_net;
  const tax_rate_implied = amount_net > 0 ? amount_tax / amount_net : 0;

  return {
    invoice_id: invoice.invoice_id, // ID no cambia
    invoice_date,
    customer_name,
    invoice_concept,
    revenue_type,
    amount_net,
    amount_total,
    status,
    payment_date,
    invoice_year,
    invoice_month,
    invoice_month_start,
    invoice_quarter,
    payment_year,
    payment_month,
    payment_month_start,
    days_to_pay,
    revenue_type_normalized,
    revenue_category,
    is_recurring,
    amount_tax,
    tax_rate_implied,
  };
}

// ============================================
// Lectura/escritura CSV
// ============================================

/**
 * Lee todas las facturas del CSV
 */
export async function readInvoicesFromCSV(): Promise<Invoice[]> {
  const content = await fs.readFile(CSV_FILE, 'utf-8');

  const result = Papa.parse<Invoice>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  // Normalizar is_recurring (puede venir como string)
  return result.data.map((inv) => ({
    ...inv,
    is_recurring: inv.is_recurring === true || (inv.is_recurring as unknown) === 'True',
    payment_date: inv.payment_date || null,
  }));
}

/**
 * Formatea un valor para CSV (mantiene formato original)
 */
function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (typeof value === 'number') {
    // Mantener decimales solo si los tiene
    return Number.isInteger(value) ? String(value) : value.toString();
  }
  const str = String(value);
  // Escapar si contiene comas o comillas
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convierte array de facturas a CSV con formato exacto
 */
function invoicesToCSV(invoices: Invoice[]): string {
  const lines: string[] = [];

  // Header
  lines.push(CSV_HEADERS.join(','));

  // Datos
  for (const inv of invoices) {
    const row = CSV_HEADERS.map((header) => {
      const value = inv[header as keyof Invoice];
      return formatCSVValue(value);
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Crea backup del CSV actual
 */
async function createBackup(): Promise<string> {
  // Crear directorio de backups si no existe
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // Nombre con timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `facturas_${timestamp}.csv`);

  // Copiar archivo actual
  await fs.copyFile(CSV_FILE, backupFile);

  return backupFile;
}

/**
 * Escribe facturas al CSV de forma segura (atomic write con backup)
 */
export async function writeInvoicesToCSV(invoices: Invoice[]): Promise<void> {
  // Lock simple para evitar escrituras concurrentes
  if (writeLock) {
    throw new Error('Otra operación de escritura está en progreso');
  }

  writeLock = true;

  try {
    // 1. Crear backup
    await createBackup();

    // 2. Escribir a archivo temporal
    const tempFile = path.join(DATA_DIR, `facturas_temp_${Date.now()}.csv`);
    const csvContent = invoicesToCSV(invoices);
    await fs.writeFile(tempFile, csvContent, 'utf-8');

    // 3. Rename atómico (reemplazar original)
    await fs.rename(tempFile, CSV_FILE);
  } finally {
    writeLock = false;
  }
}

/**
 * Verifica si un invoice_id ya existe
 */
export async function invoiceIdExists(invoiceId: string): Promise<boolean> {
  const invoices = await readInvoicesFromCSV();
  return invoices.some((inv) => inv.invoice_id === invoiceId);
}

/**
 * Obtiene lista de clientes únicos del dataset
 */
export async function getUniqueCustomers(): Promise<string[]> {
  const invoices = await readInvoicesFromCSV();
  const customers = new Set(invoices.map((inv) => inv.customer_name.trim()));
  return Array.from(customers).sort();
}
