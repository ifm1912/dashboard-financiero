'use client';

import { useState, useEffect, FormEvent } from 'react';
import {
  Invoice,
  InvoiceCreateInput,
  InvoiceEditInput,
  InvoiceValidationErrors,
  INVOICE_STATUS,
  REVENUE_TYPES,
} from '@/types';

// Constante para el IVA por defecto (21%)
const DEFAULT_VAT_RATE = 0.21;

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  invoice?: Invoice | null;
  customers: string[];
}

export function InvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  invoice,
  customers,
}: InvoiceModalProps) {
  // Estado del formulario
  const [formData, setFormData] = useState<InvoiceCreateInput>({
    invoice_id: '',
    invoice_date: '',
    customer_name: '',
    invoice_concept: '',
    revenue_type: 'Licencia',
    amount_net: 0,
    amount_total: 0,
    status: 'pending',
    payment_date: null,
  });

  // Estado para el toggle de IVA
  const [sinIva, setSinIva] = useState(false);

  const [errors, setErrors] = useState<InvoiceValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Función para normalizar revenue_type al formato esperado
  const normalizeRevenueType = (type: string): typeof REVENUE_TYPES[number] => {
    const normalized = type.toLowerCase();
    if (normalized === 'setup') return 'SetUp';
    if (normalized === 'licencia') return 'Licencia';
    return 'Licencia'; // default
  };

  // Función para normalizar status al formato esperado
  const normalizeStatus = (status: string): typeof INVOICE_STATUS[number] => {
    if (status === 'paid') return 'paid';
    return 'pending'; // 'pending', 'issued', o cualquier otro -> pending
  };

  // Inicializar formulario cuando cambia el modo o la factura
  useEffect(() => {
    if (mode === 'edit' && invoice) {
      setFormData({
        invoice_id: invoice.invoice_id,
        invoice_date: invoice.invoice_date,
        customer_name: invoice.customer_name,
        invoice_concept: invoice.invoice_concept,
        revenue_type: normalizeRevenueType(invoice.revenue_type),
        amount_net: invoice.amount_net,
        amount_total: invoice.amount_total,
        status: normalizeStatus(invoice.status),
        payment_date: invoice.payment_date,
      });
    } else if (mode === 'create') {
      // Generar ID sugerido
      const year = new Date().getFullYear();
      const suggestedId = `FACT${String(Math.floor(Math.random() * 900) + 100)}${year}`;
      setFormData({
        invoice_id: suggestedId,
        invoice_date: new Date().toISOString().split('T')[0],
        customer_name: '',
        invoice_concept: '',
        revenue_type: 'Licencia',
        amount_net: 0,
        amount_total: 0,
        status: 'pending',
        payment_date: null,
      });
      // Resetear toggle de IVA al abrir modal en modo crear
      setSinIva(false);
    }
    setErrors({});
    setApiError(null);
  }, [mode, invoice, isOpen]);

  // Calcular importe total cuando cambia el neto o el toggle de IVA
  const calculateTotal = (netAmount: number, withoutVat: boolean): number => {
    if (isNaN(netAmount) || netAmount <= 0) {
      return 0;
    }
    const total = withoutVat ? netAmount : netAmount * (1 + DEFAULT_VAT_RATE);
    // Redondear a 2 decimales
    return Math.round(total * 100) / 100;
  };

  // Efecto para recalcular el total cuando cambia el toggle de IVA
  useEffect(() => {
    if (mode === 'create') {
      const newTotal = calculateTotal(formData.amount_net, sinIva);
      setFormData((prev) => ({ ...prev, amount_total: newTotal }));
    }
  }, [sinIva, mode]);

  // Limpiar payment_date cuando status cambia a pending
  useEffect(() => {
    if (formData.status !== 'paid') {
      setFormData((prev) => ({ ...prev, payment_date: null }));
    }
  }, [formData.status]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (name === 'amount_net' && mode === 'create') {
      // Cuando cambia el importe neto, recalcular el total automáticamente
      const netValue = parseFloat(value) || 0;
      const newTotal = calculateTotal(netValue, sinIva);
      setFormData((prev) => ({
        ...prev,
        amount_net: netValue,
        amount_total: newTotal,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]:
          type === 'number'
            ? parseFloat(value) || 0
            : value === ''
            ? name === 'payment_date'
              ? null
              : ''
            : value,
      }));
    }

    // Limpiar error del campo
    if (errors[name as keyof InvoiceValidationErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError(null);

    try {
      if (mode === 'create') {
        const response = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) {
            setErrors(data.errors);
          } else {
            setApiError(data.error || 'Error al crear factura');
          }
          return;
        }
      } else {
        // Edit mode - enviar todos los campos editables
        const editInput: InvoiceEditInput = {
          invoice_date: formData.invoice_date,
          customer_name: formData.customer_name,
          invoice_concept: formData.invoice_concept,
          revenue_type: formData.revenue_type,
          amount_net: formData.amount_net,
          amount_total: formData.amount_total,
          status: formData.status,
          payment_date: formData.payment_date,
        };

        const response = await fetch(`/api/invoices/${invoice?.invoice_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editInput),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) {
            setErrors(data.errors);
          } else {
            setApiError(data.error || 'Error al actualizar factura');
          }
          return;
        }
      }

      // Éxito
      onSuccess();
      onClose();
    } catch (error) {
      setApiError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-none sm:rounded-xl border-0 sm:border border-border-subtle bg-bg-base p-4 sm:p-6 shadow-2xl h-full sm:h-auto overflow-y-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {mode === 'create' ? 'Nueva Factura' : `Editar ${invoice?.invoice_id}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error general */}
        {apiError && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ID Factura - solo editable en modo crear */}
          {mode === 'create' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                ID Factura *
              </label>
              <input
                type="text"
                name="invoice_id"
                value={formData.invoice_id}
                onChange={handleChange}
                className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.invoice_id ? 'border-danger' : 'border-border-subtle'
                }`}
                placeholder="FACT012025"
              />
              {errors.invoice_id && (
                <p className="mt-1 text-xs text-danger">{errors.invoice_id}</p>
              )}
            </div>
          )}

          {/* ID solo lectura en modo edición */}
          {mode === 'edit' && invoice && (
            <div className="rounded-lg border border-border-subtle bg-bg-surface/50 px-4 py-3">
              <span className="text-xs font-medium text-text-dimmed">ID Factura:</span>
              <span className="ml-2 text-sm font-mono text-text-primary">{invoice.invoice_id}</span>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Fecha *
            </label>
            <input
              type="date"
              name="invoice_date"
              value={formData.invoice_date}
              onChange={handleChange}
              className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                errors.invoice_date ? 'border-danger' : 'border-border-subtle'
              }`}
            />
            {errors.invoice_date && (
              <p className="mt-1 text-xs text-danger">{errors.invoice_date}</p>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Cliente *
            </label>
            <select
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                errors.customer_name ? 'border-danger' : 'border-border-subtle'
              }`}
            >
              <option value="">Seleccionar cliente</option>
              {customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.customer_name && (
              <p className="mt-1 text-xs text-danger">{errors.customer_name}</p>
            )}
          </div>

          {/* Concepto */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Concepto *
            </label>
            <input
              type="text"
              name="invoice_concept"
              value={formData.invoice_concept}
              onChange={handleChange}
              className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:ring-2 focus:ring-accent ${
                errors.invoice_concept ? 'border-danger' : 'border-border-subtle'
              }`}
              placeholder="Licencia Enero 2025"
            />
            {errors.invoice_concept && (
              <p className="mt-1 text-xs text-danger">{errors.invoice_concept}</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Tipo *
            </label>
            <select
              name="revenue_type"
              value={formData.revenue_type}
              onChange={handleChange}
              className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                errors.revenue_type ? 'border-danger' : 'border-border-subtle'
              }`}
            >
              {REVENUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.revenue_type && (
              <p className="mt-1 text-xs text-danger">{errors.revenue_type}</p>
            )}
          </div>

          {/* Toggle IVA - solo en modo crear */}
          {mode === 'create' && (
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface/50 px-4 py-3">
              <div>
                <span className="text-sm font-medium text-text-primary">IVA (21%)</span>
                <p className="text-xs text-text-dimmed">
                  {sinIva ? 'No se aplicará IVA al importe' : 'Se aplicará 21% de IVA automáticamente'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSinIva(!sinIva)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-base ${
                  sinIva ? 'bg-warning' : 'bg-accent'
                }`}
                role="switch"
                aria-checked={sinIva}
                aria-label="Toggle IVA"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    sinIva ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`ml-2 text-xs font-semibold ${sinIva ? 'text-warning' : 'text-text-dimmed'}`}>
                {sinIva ? 'SIN IVA' : 'CON IVA'}
              </span>
            </div>
          )}

          {/* Importes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Importe Neto *
              </label>
              <input
                type="number"
                name="amount_net"
                value={formData.amount_net || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.amount_net ? 'border-danger' : 'border-border-subtle'
                }`}
                placeholder="0.00"
              />
              {errors.amount_net && (
                <p className="mt-1 text-xs text-danger">{errors.amount_net}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Importe Total {mode === 'create' && !sinIva ? '(+21% IVA)' : ''} *
              </label>
              <input
                type="number"
                name="amount_total"
                value={formData.amount_total || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                readOnly={mode === 'create'}
                className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                  mode === 'create' ? 'bg-bg-surface/70 cursor-not-allowed' : ''
                } ${errors.amount_total ? 'border-danger' : 'border-border-subtle'}`}
                placeholder="0.00"
              />
              {errors.amount_total && (
                <p className="mt-1 text-xs text-danger">{errors.amount_total}</p>
              )}
              {mode === 'create' && (
                <p className="mt-1 text-xs text-text-dimmed">
                  {sinIva ? 'Igual al neto (sin IVA)' : 'Calculado automáticamente'}
                </p>
              )}
            </div>
          </div>

          {/* Estado y Fecha de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Estado *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.status ? 'border-danger' : 'border-border-subtle'
                }`}
              >
                {INVOICE_STATUS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </option>
                ))}
              </select>
              {errors.status && (
                <p className="mt-1 text-xs text-danger">{errors.status}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Fecha Pago {formData.status === 'paid' && '*'}
              </label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date || ''}
                onChange={handleChange}
                disabled={formData.status !== 'paid'}
                className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.payment_date ? 'border-danger' : 'border-border-subtle'
                }`}
              />
              {errors.payment_date && (
                <p className="mt-1 text-xs text-danger">{errors.payment_date}</p>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-surface"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
