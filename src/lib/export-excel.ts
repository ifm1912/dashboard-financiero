import * as XLSX from 'xlsx';
import { Invoice, Contract } from '@/types';

/**
 * Definición de columnas para exportación Excel.
 * Orden lógico: identificación → clasificación → importes → estado → derivados
 */
const INVOICE_COLUMNS: { key: keyof Invoice; header: string }[] = [
  // Identificación
  { key: 'invoice_id', header: 'ID Factura' },
  { key: 'invoice_date', header: 'Fecha Factura' },
  { key: 'customer_name', header: 'Cliente' },
  { key: 'invoice_concept', header: 'Concepto' },
  // Clasificación
  { key: 'revenue_type', header: 'Tipo Ingreso' },
  { key: 'revenue_type_normalized', header: 'Tipo Ingreso Normalizado' },
  { key: 'revenue_category', header: 'Categoría' },
  { key: 'is_recurring', header: 'Es Recurrente' },
  // Importes
  { key: 'amount_net', header: 'Importe Neto' },
  { key: 'amount_tax', header: 'Importe IVA' },
  { key: 'amount_total', header: 'Importe Total' },
  { key: 'tax_rate_implied', header: 'Tipo IVA Implícito' },
  // Estado y pago
  { key: 'status', header: 'Estado' },
  { key: 'payment_date', header: 'Fecha Pago' },
  { key: 'days_to_pay', header: 'Días hasta Pago' },
  // Derivados temporales
  { key: 'invoice_year', header: 'Año Factura' },
  { key: 'invoice_month', header: 'Mes Factura' },
  { key: 'invoice_month_start', header: 'Inicio Mes Factura' },
  { key: 'invoice_quarter', header: 'Trimestre' },
  { key: 'payment_year', header: 'Año Pago' },
  { key: 'payment_month', header: 'Mes Pago' },
  { key: 'payment_month_start', header: 'Inicio Mes Pago' },
];

/** Campos que contienen fechas (formato YYYY-MM-DD) */
const DATE_FIELDS: Set<keyof Invoice> = new Set([
  'invoice_date',
  'payment_date',
  'invoice_month_start',
  'payment_month_start',
]);

/** Traducciones de estado */
const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  issued: 'Emitida',
};

/** Traducciones de categoría */
const CATEGORY_LABELS: Record<string, string> = {
  recurring: 'Recurrente',
  non_recurring: 'No recurrente',
  other: 'Otro',
};

/**
 * Formatea un valor de Invoice para la celda Excel.
 * - Fechas → DD/MM/YYYY
 * - Status → traducido al español
 * - Categoría → traducida al español
 * - Booleanos → "Sí" / "No"
 * - Nulls → cadena vacía
 * - Números → sin tocar (Excel los maneja nativamente)
 */
function formatCellValue(
  key: keyof Invoice,
  value: Invoice[keyof Invoice]
): string | number {
  if (value === null || value === undefined) return '';

  // Fechas
  if (DATE_FIELDS.has(key) && typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return String(value);
  }

  // Booleano (is_recurring)
  if (key === 'is_recurring') {
    return value ? 'Sí' : 'No';
  }

  // Estado
  if (key === 'status') {
    return STATUS_LABELS[value as string] || String(value);
  }

  // Categoría de ingreso
  if (key === 'revenue_category') {
    return CATEGORY_LABELS[value as string] || String(value);
  }

  // Números: devolver tal cual para que Excel los trate como numéricos
  if (typeof value === 'number') {
    return value;
  }

  return String(value);
}

/**
 * Exporta un array de facturas a un archivo .xlsx y dispara la descarga.
 *
 * @param invoices - Array de facturas (ya filtradas/ordenadas)
 * @param filename - Nombre del archivo (opcional, por defecto facturas_YYYY-MM-DD.xlsx)
 */
export function exportInvoicesToExcel(
  invoices: Invoice[],
  filename?: string
): void {
  // Cabeceras
  const headers = INVOICE_COLUMNS.map((col) => col.header);

  // Filas de datos
  const rows = invoices.map((invoice) =>
    INVOICE_COLUMNS.map((col) => formatCellValue(col.key, invoice[col.key]))
  );

  // Crear worksheet desde array de arrays (control total del orden)
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Anchos de columna para legibilidad
  worksheet['!cols'] = INVOICE_COLUMNS.map((col) => {
    if (col.key === 'invoice_concept' || col.key === 'customer_name')
      return { wch: 30 };
    if (col.key === 'invoice_id') return { wch: 14 };
    if (DATE_FIELDS.has(col.key)) return { wch: 14 };
    if (col.key.includes('amount')) return { wch: 15 };
    return { wch: 18 };
  });

  // Crear workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

  // Nombre del archivo con fecha actual
  const date = new Date().toISOString().slice(0, 10);
  const finalFilename = filename || `facturas_${date}.xlsx`;

  // Disparar descarga
  XLSX.writeFile(workbook, finalFilename);
}

// ─── Contratos ────────────────────────────────────────────────

const CONTRACT_COLUMNS: { key: keyof Contract; header: string }[] = [
  { key: 'contract_id', header: 'ID Contrato' },
  { key: 'client_id', header: 'ID Cliente' },
  { key: 'client_name', header: 'Cliente' },
  { key: 'status', header: 'Estado' },
  { key: 'product', header: 'Producto' },
  { key: 'start_date', header: 'Fecha Inicio' },
  { key: 'end_date', header: 'Fecha Fin' },
  { key: 'billing_frequency', header: 'Frecuencia Facturación' },
  { key: 'currency', header: 'Moneda' },
  { key: 'set_up', header: 'SetUp' },
  { key: 'base_contract_value_annual', header: 'Valor Anual Base' },
  { key: 'base_mrr_eur', header: 'MRR Base (EUR)' },
  { key: 'base_arr_eur', header: 'ARR Base (EUR)' },
  { key: 'renewal_type', header: 'Tipo Renovación' },
  { key: 'notice_days', header: 'Días Preaviso' },
  { key: 'ipc_applicable', header: 'IPC Aplicable' },
  { key: 'ipc_frequency', header: 'Frecuencia IPC' },
  { key: 'ipc_application_month', header: 'Mes Aplicación IPC' },
  { key: 'current_price_annual', header: 'Precio Anual Actual' },
  { key: 'current_mrr', header: 'MRR Actual' },
  { key: 'account_owner', header: 'Account Owner' },
];

const CONTRACT_DATE_FIELDS: Set<keyof Contract> = new Set([
  'start_date',
  'end_date',
]);

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  'negociación': 'Negociación',
};

function formatContractCellValue(
  key: keyof Contract,
  value: Contract[keyof Contract]
): string | number {
  if (value === null || value === undefined) return '';

  // Fechas
  if (CONTRACT_DATE_FIELDS.has(key) && typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return String(value);
  }

  // Booleano (ipc_applicable)
  if (key === 'ipc_applicable') {
    return value ? 'Sí' : 'No';
  }

  // Estado
  if (key === 'status') {
    const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return CONTRACT_STATUS_LABELS[String(value)] || CONTRACT_STATUS_LABELS[normalized] || String(value);
  }

  // Moneda
  if (key === 'currency') {
    return String(value) === 'us dollar' ? 'USD' : 'EUR';
  }

  // Números
  if (typeof value === 'number') {
    return value;
  }

  return String(value);
}

/**
 * Exporta un array de contratos a un archivo .xlsx y dispara la descarga.
 */
export function exportContractsToExcel(
  contracts: Contract[],
  filename?: string
): void {
  const headers = CONTRACT_COLUMNS.map((col) => col.header);

  const rows = contracts.map((contract) =>
    CONTRACT_COLUMNS.map((col) => formatContractCellValue(col.key, contract[col.key]))
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  worksheet['!cols'] = CONTRACT_COLUMNS.map((col) => {
    if (col.key === 'client_name' || col.key === 'product') return { wch: 25 };
    if (CONTRACT_DATE_FIELDS.has(col.key)) return { wch: 14 };
    if (col.key.includes('price') || col.key.includes('arr') || col.key.includes('mrr') || col.key === 'set_up' || col.key === 'base_contract_value_annual')
      return { wch: 18 };
    return { wch: 16 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contratos');

  const date = new Date().toISOString().slice(0, 10);
  const finalFilename = filename || `contratos_${date}.xlsx`;

  XLSX.writeFile(workbook, finalFilename);
}
