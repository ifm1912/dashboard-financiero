'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { KPICard, InvoiceModal } from '@/components';
import { formatCurrency, formatPercent, filterInvoicesByDevengo } from '@/lib/data';
import { exportInvoicesToExcel } from '@/lib/export-excel';
import { Invoice } from '@/types';
import { useDateRange } from '@/contexts';

type SortField = 'invoice_id' | 'invoice_date' | 'customer_name' | 'revenue_category' | 'amount_net' | 'amount_total' | 'status' | 'payment_date';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;

/**
 * Parsea un ID de factura con formato FACT<correlativo><año>
 * Ejemplos: FACT012025, FACT102024, FACT0012026
 * @returns { year: number, correlative: number, valid: boolean }
 */
function parseInvoiceId(id: string): { year: number; correlative: number; valid: boolean } {
  // Formato esperado: FACT + correlativo (variable) + año (4 dígitos)
  // El año son los últimos 4 dígitos, el correlativo es lo que hay entre FACT y el año
  const match = id.match(/^FACT(\d+)(\d{4})$/i);

  if (!match) {
    return { year: 0, correlative: 0, valid: false };
  }

  const correlative = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  return { year, correlative, valid: true };
}

/**
 * Comparador para ordenar facturas por ID (año descendente, luego correlativo descendente)
 * IDs inválidos van al final
 */
function compareInvoiceIds(a: string, b: string, direction: SortDirection): number {
  const parsedA = parseInvoiceId(a);
  const parsedB = parseInvoiceId(b);

  // IDs inválidos van al final
  if (!parsedA.valid && !parsedB.valid) return 0;
  if (!parsedA.valid) return 1;
  if (!parsedB.valid) return -1;

  // Comparar por año primero
  if (parsedA.year !== parsedB.year) {
    const yearDiff = parsedA.year - parsedB.year;
    return direction === 'desc' ? -yearDiff : yearDiff;
  }

  // Si mismo año, comparar por correlativo
  const corrDiff = parsedA.correlative - parsedB.correlative;
  return direction === 'desc' ? -corrDiff : corrDiff;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { dateRange } = useDateRange();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // PDF generation state
  const [generatingPDFId, setGeneratingPDFId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Sorting - por defecto ordenar por ID (más reciente primero)
  const [sortField, setSortField] = useState<SortField>('invoice_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Cargar datos desde la API
  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/invoices');
      const data = await response.json();
      setInvoices(data.invoices);
      setCustomers(data.customers);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers del modal
  const handleCreateClick = () => {
    setModalMode('create');
    setSelectedInvoice(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (invoice: Invoice) => {
    setModalMode('edit');
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
  };

  const handleModalSuccess = () => {
    // Recargar datos después de crear/editar
    loadData();
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setGeneratingPDFId(invoice.invoice_id);
    try {
      const { generateInvoicePDF } = await import('@/lib/invoice-pdf');
      await generateInvoicePDF(invoice);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
    } finally {
      setGeneratingPDFId(null);
    }
  };

  // Filtrar por rango de fechas global primero
  const globalFilteredInvoices = useMemo(() => {
    return filterInvoicesByDevengo(invoices, dateRange);
  }, [invoices, dateRange]);

  // Get unique customers for filter (de datos filtrados globalmente)
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(globalFilteredInvoices.map(inv => inv.customer_name))];
    return customers.sort();
  }, [globalFilteredInvoices]);

  // Filter and sort invoices (filtros locales sobre datos ya filtrados globalmente)
  const filteredInvoices = useMemo(() => {
    let result = [...globalFilteredInvoices];

    // Apply filters
    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter(inv => inv.revenue_category === categoryFilter);
    }
    if (customerFilter !== 'all') {
      result = result.filter(inv => inv.customer_name === customerFilter);
    }
    if (dateFrom) {
      result = result.filter(inv => inv.invoice_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(inv => inv.invoice_date <= dateTo);
    }

    // Apply sorting
    result.sort((a, b) => {
      // Usar comparador especial para invoice_id
      if (sortField === 'invoice_id') {
        return compareInvoiceIds(a.invoice_id, b.invoice_id, sortDirection);
      }

      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Compare
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return result;
  }, [globalFilteredInvoices, statusFilter, categoryFilter, customerFilter, dateFrom, dateTo, sortField, sortDirection]);

  // Calculate KPIs for filtered data
  const kpis = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
    const paidCount = filteredInvoices.filter(inv => inv.status === 'paid').length;
    const paidPercentage = filteredInvoices.length > 0
      ? (paidCount / filteredInvoices.length) * 100
      : 0;

    return {
      totalAmount,
      count: filteredInvoices.length,
      paidPercentage,
    };
  }, [filteredInvoices]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, customerFilter, dateFrom, dateTo]);

  const handleExportExcel = useCallback(() => {
    if (filteredInvoices.length === 0) return;
    exportInvoicesToExcel(filteredInvoices);
  }, [filteredInvoices]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-text-muted ml-1 opacity-50">↕</span>;
    }
    return <span className="text-accent-light ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setCustomerFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || customerFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header con botones */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Facturas</h1>
          <p className="text-sm text-text-muted">Gestión y seguimiento de facturación</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportExcel}
            disabled={filteredInvoices.length === 0}
            className="flex items-center gap-1 sm:gap-2 rounded-lg border border-border-subtle px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1 sm:gap-2 rounded-lg bg-accent px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nueva factura</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* KPIs for filtered data */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
        <KPICard
          label="Total Filtrado"
          value={formatCurrency(kpis.totalAmount)}
        />
        <KPICard
          label="Nº Facturas"
          value={String(kpis.count)}
        />
        <KPICard
          label="% Pagadas"
          value={formatPercent(kpis.paidPercentage)}
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          {/* Status Filter */}
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagadas</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todas</option>
              <option value="recurring">Recurrente</option>
              <option value="non_recurring">No Recurrente</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Cliente</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todos</option>
              {uniqueCustomers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Date To */}
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary">Listado de Facturas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-t border-border-subtle">
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('invoice_id')}
                >
                  ID <SortIcon field="invoice_id" />
                </th>
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('invoice_date')}
                >
                  Fecha <SortIcon field="invoice_date" />
                </th>
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('customer_name')}
                >
                  Cliente <SortIcon field="customer_name" />
                </th>
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('revenue_category')}
                >
                  Tipo <SortIcon field="revenue_category" />
                </th>
                <th
                  className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('amount_net')}
                >
                  Neto <SortIcon field="amount_net" />
                </th>
                <th
                  className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('amount_total')}
                >
                  Total <SortIcon field="amount_total" />
                </th>
                <th
                  className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Estado <SortIcon field="status" />
                </th>
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('payment_date')}
                >
                  Pago <SortIcon field="payment_date" />
                </th>
                <th className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((invoice, index) => (
                <tr
                  key={invoice.invoice_id}
                  className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                >
                  <td className="px-5 py-3 text-sm font-mono text-text-muted">
                    {invoice.invoice_id}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-primary">
                    {new Date(invoice.invoice_date).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-primary">
                    {invoice.customer_name}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${
                      invoice.revenue_category === 'recurring'
                        ? 'text-accent-light'
                        : 'text-text-muted'
                    }`}>
                      {invoice.revenue_category === 'recurring' ? 'Recurrente' : 'No recurrente'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                    {formatCurrency(invoice.amount_net)}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-primary font-medium">
                    {formatCurrency(invoice.amount_total)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      invoice.status === 'paid'
                        ? 'bg-success-muted text-success'
                        : 'bg-warning-muted text-warning'
                    }`}>
                      {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-dimmed">
                    {invoice.payment_date
                      ? new Date(invoice.payment_date).toLocaleDateString('es-ES')
                      : '—'
                    }
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEditClick(invoice)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(invoice)}
                        disabled={generatingPDFId === invoice.invoice_id}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
                      >
                        {generatingPDFId === invoice.invoice_id ? (
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            PDF
                          </span>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border-subtle px-3 sm:px-5 py-3">
            <p className="text-xs text-text-dimmed">
              {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} de {filteredInvoices.length}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      currentPage === pageNum
                        ? 'bg-bg-elevated text-text-primary'
                        : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de crear/editar factura */}
      <InvoiceModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        mode={modalMode}
        invoice={selectedInvoice}
        customers={customers}
      />
    </div>
  );
}
