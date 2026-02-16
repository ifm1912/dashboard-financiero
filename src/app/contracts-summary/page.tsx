'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { KPICard } from '@/components';
import { getContracts, formatCurrency } from '@/lib/data';
import { exportContractsToExcel } from '@/lib/export-excel';
import { Contract } from '@/types';

type SortField = 'status' | 'client_name' | 'contract_id' | 'product' | 'start_date' | 'set_up' | 'base_arr_eur' | 'current_price_annual' | 'current_mrr' | 'account_owner';
type SortDirection = 'asc' | 'desc';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function normalizeStatus(status: string): string {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function ContractsSummaryPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('client_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getContracts();
        setContracts(data);
      } catch (error) {
        console.error('Error loading contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Unique owners for filter
  const uniqueOwners = useMemo(() => {
    const owners = [...new Set(contracts.map(c => c.account_owner))];
    return owners.sort();
  }, [contracts]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    if (statusFilter !== 'all') {
      result = result.filter(c => normalizeStatus(c.status) === statusFilter);
    }
    if (ownerFilter !== 'all') {
      result = result.filter(c => c.account_owner === ownerFilter);
    }
    if (typeFilter !== 'all') {
      if (typeFilter === 'recurring') {
        result = result.filter(c => c.base_arr_eur > 0);
      } else {
        result = result.filter(c => c.base_arr_eur === 0);
      }
    }

    return result;
  }, [contracts, statusFilter, ownerFilter, typeFilter]);

  // Sort contracts
  const sortedContracts = useMemo(() => {
    const result = [...filteredContracts];

    result.sort((a, b) => {
      let aVal: string | number | boolean | null = a[sortField];
      let bVal: string | number | boolean | null = b[sortField];

      // Handle null values - nulls go last
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr, 'es')
        : bStr.localeCompare(aStr, 'es');
    });

    return result;
  }, [filteredContracts, sortField, sortDirection]);

  // KPIs
  const kpis = useMemo(() => {
    const active = contracts.filter(c => normalizeStatus(c.status) === 'activo');
    const negotiation = contracts.filter(c => normalizeStatus(c.status) === 'negociacion');

    const arrActivo = active
      .filter(c => c.base_arr_eur > 0)
      .reduce((sum, c) => sum + c.current_price_annual, 0);

    const pipeline = negotiation.reduce((sum, c) => sum + c.current_price_annual, 0);

    const setupTotal = contracts.reduce((sum, c) => sum + c.set_up, 0);

    const uniqueClients = new Set(contracts.map(c => c.client_id)).size;

    return {
      total: contracts.length,
      activeCount: active.length,
      negotiationCount: negotiation.length,
      arrActivo,
      pipeline,
      setupTotal,
      uniqueClients,
    };
  }, [contracts]);

  // Totals for footer (based on filtered contracts)
  const totals = useMemo(() => ({
    setUp: filteredContracts.reduce((sum, c) => sum + c.set_up, 0),
    baseArr: filteredContracts.reduce((sum, c) => sum + c.base_arr_eur, 0),
    currentArr: filteredContracts.reduce((sum, c) => sum + c.current_price_annual, 0),
    mrr: filteredContracts.reduce((sum, c) => sum + c.current_mrr, 0),
  }), [filteredContracts]);

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
    setOwnerFilter('all');
    setTypeFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || ownerFilter !== 'all' || typeFilter !== 'all';

  const handleExportExcel = useCallback(() => {
    if (sortedContracts.length === 0) return;
    exportContractsToExcel(sortedContracts);
  }, [sortedContracts]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Hoja de Contratos</h1>
          <p className="text-sm text-text-muted">Registro completo de contratos activos, inactivos y en negociación</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={sortedContracts.length === 0}
          className="flex items-center gap-1 sm:gap-2 rounded-lg border border-border-subtle px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Excel</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KPICard
          label="Total Contratos"
          value={String(kpis.total)}
          subtitle={`${kpis.activeCount} activos, ${kpis.negotiationCount} en negociación`}
        />
        <KPICard
          label="ARR Activo"
          value={formatCurrency(kpis.arrActivo)}
          subtitle="Solo recurrentes"
        />
        <KPICard
          label="Pipeline"
          value={formatCurrency(kpis.pipeline)}
          subtitle={`${kpis.negotiationCount} en negociación`}
        />
        <KPICard
          label="SetUp Total"
          value={formatCurrency(kpis.setupTotal)}
          subtitle="Fees acumulados"
        />
        <KPICard
          label="Clientes Únicos"
          value={String(kpis.uniqueClients)}
          subtitle="Todos los estados"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          {/* Status */}
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="negociacion">Negociación</option>
            </select>
          </div>

          {/* Owner */}
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Owner</label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todos</option>
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            >
              <option value="all">Todos</option>
              <option value="recurring">Recurrente</option>
              <option value="non_recurring">No recurrente</option>
            </select>
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
          <h3 className="text-sm font-medium text-text-secondary">
            Registro de Contratos
            <span className="ml-2 text-xs text-text-dimmed font-normal">
              {sortedContracts.length} de {contracts.length}
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="border-t border-border-subtle">
                <th
                  className="px-4 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Estado <SortIcon field="status" />
                </th>
                <th
                  className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('client_name')}
                >
                  Cliente <SortIcon field="client_name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('contract_id')}
                >
                  ID <SortIcon field="contract_id" />
                </th>
                <th
                  className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('product')}
                >
                  Producto <SortIcon field="product" />
                </th>
                <th
                  className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('start_date')}
                >
                  Inicio <SortIcon field="start_date" />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Fin
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Facturación
                </th>
                <th
                  className="px-4 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('set_up')}
                >
                  SetUp <SortIcon field="set_up" />
                </th>
                <th
                  className="px-4 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('base_arr_eur')}
                >
                  ARR Base <SortIcon field="base_arr_eur" />
                </th>
                <th
                  className="px-4 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('current_price_annual')}
                >
                  ARR Actual <SortIcon field="current_price_annual" />
                </th>
                <th
                  className="px-4 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('current_mrr')}
                >
                  MRR <SortIcon field="current_mrr" />
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  IPC
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                  Moneda
                </th>
                <th
                  className="px-4 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                  onClick={() => handleSort('account_owner')}
                >
                  Owner <SortIcon field="account_owner" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedContracts.map((contract, index) => {
                const isInactive = normalizeStatus(contract.status) === 'inactivo';
                return (
                  <tr
                    key={contract.contract_id}
                    className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''} ${isInactive ? 'opacity-60' : ''}`}
                  >
                    {/* Estado */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        normalizeStatus(contract.status) === 'activo'
                          ? 'bg-success-muted text-success'
                          : normalizeStatus(contract.status) === 'inactivo'
                          ? 'bg-danger-muted text-danger'
                          : 'bg-warning-muted text-warning'
                      }`}>
                        {normalizeStatus(contract.status) === 'activo' ? 'Activo' :
                         normalizeStatus(contract.status) === 'inactivo' ? 'Inactivo' : 'Negociación'}
                      </span>
                    </td>
                    {/* Cliente */}
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">
                      {contract.client_name}
                    </td>
                    {/* ID */}
                    <td className="px-4 py-3 text-sm font-mono text-text-dimmed">
                      {contract.contract_id}
                    </td>
                    {/* Producto */}
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {contract.product}
                    </td>
                    {/* Inicio */}
                    <td className="px-4 py-3 text-sm text-text-muted">
                      {formatDate(contract.start_date)}
                    </td>
                    {/* Fin */}
                    <td className="px-4 py-3 text-sm">
                      {contract.end_date
                        ? <span className="text-text-muted">{formatDate(contract.end_date)}</span>
                        : <span className="text-text-dimmed italic">Indefinido</span>
                      }
                    </td>
                    {/* Facturación */}
                    <td className="px-4 py-3 text-center">
                      {contract.billing_frequency ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          contract.billing_frequency === 'trimestral'
                            ? 'bg-tertiary/10 text-tertiary'
                            : 'bg-text-dimmed/10 text-text-muted'
                        }`}>
                          {contract.billing_frequency.charAt(0).toUpperCase() + contract.billing_frequency.slice(1)}
                        </span>
                      ) : (
                        <span className="text-text-dimmed">--</span>
                      )}
                    </td>
                    {/* SetUp */}
                    <td className="px-4 py-3 text-sm text-right font-mono text-text-secondary">
                      {contract.set_up > 0 ? formatCurrency(contract.set_up) : <span className="text-text-dimmed">--</span>}
                    </td>
                    {/* ARR Base */}
                    <td className="px-4 py-3 text-sm text-right font-mono text-text-muted">
                      {contract.base_arr_eur > 0 ? formatCurrency(contract.base_arr_eur) : <span className="text-text-dimmed">--</span>}
                    </td>
                    {/* ARR Actual */}
                    <td className="px-4 py-3 text-sm text-right font-mono font-medium text-text-primary">
                      {contract.current_price_annual > 0 ? formatCurrency(contract.current_price_annual) : <span className="text-text-dimmed font-normal">--</span>}
                    </td>
                    {/* MRR */}
                    <td className="px-4 py-3 text-sm text-right font-mono text-text-secondary">
                      {contract.current_mrr > 0 ? formatCurrency(contract.current_mrr) : <span className="text-text-dimmed">--</span>}
                    </td>
                    {/* IPC */}
                    <td className="px-4 py-3 text-center text-sm">
                      {contract.ipc_applicable
                        ? <span className="text-success">✓</span>
                        : <span className="text-text-dimmed">--</span>
                      }
                    </td>
                    {/* Moneda */}
                    <td className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase">
                      {contract.currency === 'us dollar' ? 'USD' : 'EUR'}
                    </td>
                    {/* Owner */}
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {contract.account_owner}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-default bg-bg-surface/50">
                <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-text-primary">
                  Total ({sortedContracts.length} contratos)
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-text-primary">
                  {formatCurrency(totals.setUp)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-text-muted">
                  {formatCurrency(totals.baseArr)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-text-primary">
                  {formatCurrency(totals.currentArr)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-text-secondary">
                  {formatCurrency(totals.mrr)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
