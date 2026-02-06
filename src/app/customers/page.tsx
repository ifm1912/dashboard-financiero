'use client';

import { useEffect, useState, useMemo } from 'react';
import { KPICard } from '@/components';
import { getInvoices, formatCurrency, formatPercent, filterInvoicesByDevengo } from '@/lib/data';
import { Invoice } from '@/types';
import { useDateRange } from '@/contexts';

interface CustomerData {
  customer_name: string;
  total_facturas: number;
  ingresos_totales: number;
  ingresos_recurrentes: number;
  porcentaje_recurrente: number;
  primera_factura: string;
  ultima_factura: string;
  estado_cliente: 'activo' | 'inactivo';
}

type SortField = keyof CustomerData;
type SortDirection = 'asc' | 'desc';

export default function CustomersPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('ingresos_totales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { dateRange } = useDateRange();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInvoices();
        setInvoices(data);
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtrar facturas por rango de fechas
  const filteredInvoices = useMemo(() => {
    return filterInvoicesByDevengo(invoices, dateRange);
  }, [invoices, dateRange]);

  // Calculate customer data
  const customers = useMemo(() => {
    const customerMap = new Map<string, {
      invoices: Invoice[];
      recurring_amount: number;
      total_amount: number;
    }>();

    // Group invoices by customer
    filteredInvoices.forEach(inv => {
      const name = inv.customer_name.trim();
      if (!customerMap.has(name)) {
        customerMap.set(name, { invoices: [], recurring_amount: 0, total_amount: 0 });
      }
      const customer = customerMap.get(name)!;
      customer.invoices.push(inv);
      customer.total_amount += inv.amount_net;
      if (inv.is_recurring || inv.revenue_category === 'recurring') {
        customer.recurring_amount += inv.amount_net;
      }
    });

    // Calculate 6 months ago date
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Build customer data array
    const result: CustomerData[] = [];
    customerMap.forEach((data, name) => {
      const dates = data.invoices.map(inv => inv.invoice_date).sort();
      const primera_factura = dates[0];
      const ultima_factura = dates[dates.length - 1];
      const estado_cliente = ultima_factura >= sixMonthsAgoStr ? 'activo' : 'inactivo';
      const porcentaje_recurrente = data.total_amount > 0
        ? (data.recurring_amount / data.total_amount) * 100
        : 0;

      result.push({
        customer_name: name,
        total_facturas: data.invoices.length,
        ingresos_totales: data.total_amount,
        ingresos_recurrentes: data.recurring_amount,
        porcentaje_recurrente,
        primera_factura,
        ultima_factura,
        estado_cliente,
      });
    });

    return result;
  }, [filteredInvoices]);

  // Sort customers
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [customers, sortField, sortDirection]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalClientes = customers.length;
    const clientesActivos = customers.filter(c => c.estado_cliente === 'activo').length;
    const clientesConRecurrente = customers.filter(c => c.ingresos_recurrentes > 0).length;
    const porcentajeRecurrentes = totalClientes > 0
      ? (clientesConRecurrente / totalClientes) * 100
      : 0;

    // Top cliente por ingresos
    const topCliente = customers.reduce((top, c) =>
      c.ingresos_totales > (top?.ingresos_totales || 0) ? c : top,
      customers[0]
    );

    return {
      totalClientes,
      clientesActivos,
      porcentajeRecurrentes,
      topCliente,
    };
  }, [customers]);

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

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KPICard
          label="Total Clientes"
          value={String(kpis.totalClientes)}
        />
        <KPICard
          label="Clientes Activos"
          value={String(kpis.clientesActivos)}
          subtitle="Última factura < 6 meses"
        />
        <KPICard
          label="% Con Recurrente"
          value={formatPercent(kpis.porcentajeRecurrentes)}
        />
        <KPICard
          label="Top Cliente"
          value={kpis.topCliente?.customer_name || '-'}
          subtitle={kpis.topCliente ? formatCurrency(kpis.topCliente.ingresos_totales) : undefined}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary">Listado de Clientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border-subtle">
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('customer_name')}
                >
                  Cliente <SortIcon field="customer_name" />
                </th>
                <th
                  className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('total_facturas')}
                >
                  Facturas <SortIcon field="total_facturas" />
                </th>
                <th
                  className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('ingresos_totales')}
                >
                  Ingresos <SortIcon field="ingresos_totales" />
                </th>
                <th
                  className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('ingresos_recurrentes')}
                >
                  Recurrentes <SortIcon field="ingresos_recurrentes" />
                </th>
                <th
                  className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('porcentaje_recurrente')}
                >
                  % Rec <SortIcon field="porcentaje_recurrente" />
                </th>
                <th
                  className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('ultima_factura')}
                >
                  Última Fact. <SortIcon field="ultima_factura" />
                </th>
                <th
                  className="px-5 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('estado_cliente')}
                >
                  Estado <SortIcon field="estado_cliente" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((customer, index) => (
                <tr
                  key={customer.customer_name}
                  className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                >
                  <td className="px-5 py-3 text-sm font-medium text-text-primary">
                    {customer.customer_name}
                  </td>
                  <td className="px-5 py-3 text-sm text-center text-text-secondary">
                    {customer.total_facturas}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-text-secondary">
                    {formatCurrency(customer.ingresos_totales)}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-accent-light">
                    {formatCurrency(customer.ingresos_recurrentes)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-1 w-10 rounded-full bg-bg-muted overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min(100, customer.porcentaje_recurrente)}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-dimmed w-10">
                        {formatPercent(customer.porcentaje_recurrente)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-muted">
                    {new Date(customer.ultima_factura).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      customer.estado_cliente === 'activo'
                        ? 'bg-success-muted text-success'
                        : 'bg-bg-muted text-text-dimmed'
                    }`}>
                      {customer.estado_cliente === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
