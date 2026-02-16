'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { KPICard, ContractDetailDrawer } from '@/components';
import { getContracts, getContractEvents, formatCurrency } from '@/lib/data';
import { exportContractsToExcel } from '@/lib/export-excel';
import { Contract, ContractEvent } from '@/types';

// ─── Types ────────────────────────────────────────────────────

type SortField = 'client_name' | 'status' | 'product' | 'current_price_annual' | 'current_mrr' | 'end_date' | 'account_owner';
type SortDirection = 'asc' | 'desc';
type Density = 'compact' | 'comfortable';

// ─── Constants ────────────────────────────────────────────────

const CLIENT_LOGO_MAP: Record<string, string> = {
  SAM: '/logos/sam.png',
  AIV: '/logos/aiv.jpg',
  CKB: '/logos/ckb.png',
  AND: '/logos/and.jpg',
  MY: '/logos/my.png',
  CAS: '/logos/cas.png',
  BKT: '/logos/bkt.png',
  IND: '/logos/ind.png',
  CJM: '/logos/cjm.jpg',
  MTUA: '/logos/mtua.svg',
  FDP: '/logos/fdp.png',
  ABC: '/logos/abc.png',
  SKD: '/logos/skd.svg',
  PVR: '/logos/pvr.jpg',
  PRS: '/logos/prs.png',
  SAN: '/logos/san.png',
  SAB: '/logos/sab.png',
};

const AVATAR_COLORS = [
  'bg-accent-muted text-accent',
  'bg-success-muted text-success',
  'bg-warning-muted text-warning',
  'bg-[rgba(220,38,38,0.10)] text-danger',
  'bg-[rgba(37,99,235,0.10)] text-info',
  'bg-[rgba(124,58,237,0.10)] text-[#7c3aed]',
];

const OWNER_COLORS: Record<string, string> = {
  Isa: 'bg-accent-muted text-accent',
  Nacho: 'bg-success-muted text-success',
  Jorge: 'bg-warning-muted text-warning',
};

// ─── Helpers ──────────────────────────────────────────────────

function normalizeStatus(status: string): string {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getRenewalInfo(endDate: string | null): { text: string; className: string; sortValue: number } {
  if (!endDate) return { text: 'Indefinido', className: 'text-text-dimmed italic', sortValue: 99999 };
  const end = new Date(endDate);
  const today = new Date();
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: 'Vencido', className: 'text-danger font-medium', sortValue: diffDays };
  if (diffDays <= 90) return { text: `${diffDays}d`, className: 'text-warning font-medium', sortValue: diffDays };
  return { text: `${diffDays}d`, className: 'text-text-muted', sortValue: diffDays };
}

// ─── Inline Components ────────────────────────────────────────

function ClientAvatar({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [imgError, setImgError] = useState(false);
  const logoSrc = CLIENT_LOGO_MAP[clientId];

  if (logoSrc && !imgError) {
    return (
      <img
        src={logoSrc}
        alt={clientName}
        title={clientName}
        className="h-8 max-w-[100px] object-contain flex-shrink-0 rounded-md"
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = clientId.slice(0, 2).toUpperCase();
  return (
    <div title={clientName} className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(clientId)}`}>
      {initials}
    </div>
  );
}

function OwnerAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const color = OWNER_COLORS[name] || 'bg-bg-muted text-text-muted';
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${color}`} title={name}>
      {initial}
    </div>
  );
}

// ─── Quick Filter Chips ───────────────────────────────────────

interface QuickChip {
  id: string;
  label: string;
  predicate: (c: Contract) => boolean;
}

const QUICK_CHIPS: QuickChip[] = [
  {
    id: 'renews_90d',
    label: 'Renueva en 90d',
    predicate: (c) => {
      if (!c.end_date) return false;
      const diff = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
      return diff > 0 && diff <= 90;
    },
  },
  {
    id: 'indefinido',
    label: 'Indefinido',
    predicate: (c) => c.end_date === null,
  },
  {
    id: 'setup',
    label: 'Setup > 0',
    predicate: (c) => c.set_up > 0,
  },
  {
    id: 'negociacion',
    label: 'En negociación',
    predicate: (c) => normalizeStatus(c.status) === 'negociacion',
  },
];

// ─── Page Component ───────────────────────────────────────────

export default function ContractsSummaryPage() {
  // Data
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractEvents, setContractEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeKPIFilter, setActiveKPIFilter] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // UI
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [density, setDensity] = useState<Density>('comfortable');
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [c, e] = await Promise.all([getContracts(), getContractEvents()]);
        setContracts(c);
        setContractEvents(e);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Event notes map for search
  const eventNotesMap = useMemo(() => {
    const map = new Map<string, string>();
    contractEvents.forEach((e) => {
      const existing = map.get(e.contract_id) || '';
      const notes = [e.reason, e.notes].filter(Boolean).join(' ');
      map.set(e.contract_id, existing + ' ' + notes);
    });
    return map;
  }, [contractEvents]);

  // Unique owners
  const uniqueOwners = useMemo(() => {
    return [...new Set(contracts.map((c) => c.account_owner))].sort();
  }, [contracts]);

  // Chip counts (from ALL contracts, not filtered)
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    QUICK_CHIPS.forEach((chip) => {
      counts[chip.id] = contracts.filter(chip.predicate).length;
    });
    return counts;
  }, [contracts]);

  // Filter chain
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Status
    if (statusFilter !== 'all') {
      result = result.filter((c) => normalizeStatus(c.status) === statusFilter);
    }
    // Owner
    if (ownerFilter !== 'all') {
      result = result.filter((c) => c.account_owner === ownerFilter);
    }
    // Type
    if (typeFilter !== 'all') {
      if (typeFilter === 'recurring') {
        result = result.filter((c) => c.base_arr_eur > 0);
      } else {
        result = result.filter((c) => c.base_arr_eur === 0);
      }
    }
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => {
        const notes = eventNotesMap.get(c.contract_id) || '';
        return (
          c.client_name.toLowerCase().includes(q) ||
          c.product.toLowerCase().includes(q) ||
          c.client_id.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)
        );
      });
    }
    // Quick chip
    if (activeChip) {
      const chip = QUICK_CHIPS.find((ch) => ch.id === activeChip);
      if (chip) result = result.filter(chip.predicate);
    }

    return result;
  }, [contracts, statusFilter, ownerFilter, typeFilter, searchQuery, activeChip, eventNotesMap]);

  // Sort
  const sortedContracts = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = { activo: 1, negociacion: 2, inactivo: 3 };
    const result = [...filteredContracts];
    result.sort((a, b) => {
      // Special sort for end_date: use renewal days
      if (sortField === 'end_date') {
        const aVal = getRenewalInfo(a.end_date).sortValue;
        const bVal = getRenewalInfo(b.end_date).sortValue;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Special sort for status: activo → negociación → inactivo
      if (sortField === 'status') {
        const aOrder = STATUS_ORDER[normalizeStatus(a.status)] ?? 99;
        const bOrder = STATUS_ORDER[normalizeStatus(b.status)] ?? 99;
        if (aOrder !== bOrder) return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
        return a.client_name.localeCompare(b.client_name, 'es');
      }

      let aVal: string | number | boolean | null = a[sortField];
      let bVal: string | number | boolean | null = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr, 'es') : bStr.localeCompare(aStr, 'es');
    });
    return result;
  }, [filteredContracts, sortField, sortDirection]);

  // KPIs (from ALL contracts)
  const kpis = useMemo(() => {
    const active = contracts.filter((c) => normalizeStatus(c.status) === 'activo');
    const negotiation = contracts.filter((c) => normalizeStatus(c.status) === 'negociacion');
    return {
      total: contracts.length,
      activeCount: active.length,
      negotiationCount: negotiation.length,
      arrActivo: active.filter((c) => c.base_arr_eur > 0).reduce((s, c) => s + c.current_price_annual, 0),
      pipeline: negotiation.reduce((s, c) => s + c.current_price_annual, 0),
    };
  }, [contracts]);

  // Totals (from filtered)
  const totals = useMemo(
    () => ({
      currentArr: filteredContracts.reduce((s, c) => s + c.current_price_annual, 0),
      mrr: filteredContracts.reduce((s, c) => s + c.current_mrr, 0),
    }),
    [filteredContracts]
  );

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-text-muted ml-1 opacity-50">↕</span>;
    return <span className="text-accent-light ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const clearAllFilters = useCallback(() => {
    setStatusFilter('all');
    setOwnerFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    setActiveKPIFilter(null);
    setActiveChip(null);
  }, []);

  const handleKPIClick = useCallback(
    (kpiId: string) => {
      if (activeKPIFilter === kpiId) {
        // Toggle off
        clearAllFilters();
        return;
      }
      // Reset everything first
      setSearchQuery('');
      setActiveChip(null);
      setActiveKPIFilter(kpiId);

      switch (kpiId) {
        case 'total':
          setStatusFilter('all');
          setOwnerFilter('all');
          setTypeFilter('all');
          break;
        case 'arr':
          setStatusFilter('activo');
          setOwnerFilter('all');
          setTypeFilter('recurring');
          break;
        case 'pipeline':
          setStatusFilter('negociacion');
          setOwnerFilter('all');
          setTypeFilter('all');
          break;
      }
    },
    [activeKPIFilter, clearAllFilters]
  );

  const handleChipClick = useCallback(
    (chipId: string) => {
      setActiveChip((prev) => (prev === chipId ? null : chipId));
      setActiveKPIFilter(null);
    },
    []
  );

  const handleExportExcel = useCallback(() => {
    if (sortedContracts.length === 0) return;
    exportContractsToExcel(sortedContracts);
  }, [sortedContracts]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    ownerFilter !== 'all' ||
    typeFilter !== 'all' ||
    searchQuery !== '' ||
    activeChip !== null ||
    activeKPIFilter !== null;

  // Density classes
  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4';
  const cellText = density === 'compact' ? 'text-xs' : 'text-sm';
  const headerText = density === 'compact' ? 'text-[9px]' : 'text-[10px]';
  const headerPad = density === 'compact' ? 'py-2 px-3' : 'py-3 px-4';

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Hoja de Contratos</h1>
          <p className="text-sm text-text-muted">Registro completo de contratos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Density toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-border-subtle overflow-hidden">
            <button
              onClick={() => setDensity('compact')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                density === 'compact' ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover'
              }`}
              title="Compacto"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                density === 'comfortable' ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover'
              }`}
              title="Cómodo"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h16M4 19h16" />
              </svg>
            </button>
          </div>
          {/* Export */}
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
      </div>

      {/* ─── KPIs (collapsible) ─── */}
      <div>
        <button
          onClick={() => setKpiCollapsed((p) => !p)}
          className="flex items-center gap-1 text-xs font-medium text-text-dimmed uppercase tracking-wider mb-3 hover:text-text-muted transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${kpiCollapsed ? '-rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Resumen
        </button>
        {!kpiCollapsed && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <KPICard
              label="Total Contratos"
              value={String(kpis.total)}
              subtitle={`${kpis.activeCount} activos, ${kpis.negotiationCount} en negociación`}
              onClick={() => handleKPIClick('total')}
              active={activeKPIFilter === 'total'}
            />
            <KPICard
              label="ARR Activo"
              value={formatCurrency(kpis.arrActivo)}
              subtitle="Solo recurrentes"
              onClick={() => handleKPIClick('arr')}
              active={activeKPIFilter === 'arr'}
            />
            <KPICard
              label="Pipeline"
              value={formatCurrency(kpis.pipeline)}
              subtitle={`${kpis.negotiationCount} en negociación`}
              onClick={() => handleKPIClick('pipeline')}
              active={activeKPIFilter === 'pipeline'}
            />
          </div>
        )}
      </div>

      {/* ─── Filters (collapsible) ─── */}
      <div>
        <button
          onClick={() => setFiltersCollapsed((p) => !p)}
          className="flex items-center gap-1 text-xs font-medium text-text-dimmed uppercase tracking-wider mb-3 hover:text-text-muted transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${filtersCollapsed ? '-rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filtros
          {hasActiveFilters && (
            <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />
          )}
        </button>
        {!filtersCollapsed && (
          <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-4 space-y-3">
            {/* Search + selects row */}
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
              {/* Search */}
              <div className="col-span-2 sm:col-span-1 sm:min-w-[200px] sm:flex-1 sm:max-w-[280px]">
                <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Buscar</label>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setActiveKPIFilter(null); }}
                    placeholder="Cliente, producto..."
                    className="w-full rounded-lg border border-border-subtle bg-bg-base pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-dimmed focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {/* Estado */}
              <div className="min-w-[110px]">
                <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setActiveKPIFilter(null); }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                >
                  <option value="all">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="negociacion">Negociación</option>
                </select>
              </div>
              {/* Owner */}
              <div className="min-w-[100px]">
                <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Owner</label>
                <select
                  value={ownerFilter}
                  onChange={(e) => { setOwnerFilter(e.target.value); setActiveKPIFilter(null); }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                >
                  <option value="all">Todos</option>
                  {uniqueOwners.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              {/* Tipo */}
              <div className="min-w-[120px]">
                <label className="mb-1.5 block text-[10px] font-medium text-text-dimmed uppercase tracking-wider">Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setActiveKPIFilter(null); }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                >
                  <option value="all">Todos</option>
                  <option value="recurring">Recurrente</option>
                  <option value="non_recurring">No recurrente</option>
                </select>
              </div>
              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => handleChipClick(chip.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    activeChip === chip.id
                      ? 'bg-accent-muted text-accent border-accent'
                      : 'border-border-subtle text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                  }`}
                  role="button"
                  aria-pressed={activeChip === chip.id}
                >
                  {chip.label}
                  <span className={`ml-1.5 ${activeChip === chip.id ? 'text-accent/60' : 'text-text-dimmed'}`}>
                    {chipCounts[chip.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-bg-surface">
              <tr className="border-b border-border-subtle">
                <th
                  className={`${headerPad} text-left ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('client_name')}
                >
                  Cliente <SortIcon field="client_name" />
                </th>
                <th
                  className={`${headerPad} text-center ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('status')}
                >
                  Estado <SortIcon field="status" />
                </th>
                <th
                  className={`${headerPad} text-left ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('product')}
                >
                  Producto <SortIcon field="product" />
                </th>
                <th
                  className={`${headerPad} text-right ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('current_price_annual')}
                >
                  ARR Actual <SortIcon field="current_price_annual" />
                </th>
                <th
                  className={`${headerPad} text-right ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('current_mrr')}
                >
                  MRR <SortIcon field="current_mrr" />
                </th>
                <th
                  className={`${headerPad} text-left ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('end_date')}
                >
                  Renovación <SortIcon field="end_date" />
                </th>
                <th
                  className={`${headerPad} text-center ${headerText} font-medium text-text-dimmed uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors`}
                  onClick={() => handleSort('account_owner')}
                >
                  Owner <SortIcon field="account_owner" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedContracts.map((contract, index) => {
                const isInactive = normalizeStatus(contract.status) === 'inactivo';
                const renewal = getRenewalInfo(contract.end_date);
                const status = normalizeStatus(contract.status);

                return (
                  <tr
                    key={contract.contract_id}
                    onClick={() => setSelectedContract(contract)}
                    className={`cursor-pointer transition-colors hover:bg-bg-hover ${
                      index !== 0 ? 'border-t border-border-subtle' : ''
                    } ${isInactive ? 'opacity-60' : ''}`}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedContract(contract); }}
                  >
                    {/* Cliente */}
                    <td className={`${cellPad} ${cellText}`}>
                      <ClientAvatar clientId={contract.client_id} clientName={contract.client_name} />
                    </td>
                    {/* Estado */}
                    <td className={`${cellPad} text-center`}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          status === 'activo'
                            ? 'bg-success-muted text-success'
                            : status === 'inactivo'
                            ? 'bg-danger-muted text-danger'
                            : 'bg-warning-muted text-warning'
                        }`}
                      >
                        {status === 'activo' ? 'Activo' : status === 'inactivo' ? 'Inactivo' : 'Negociación'}
                      </span>
                    </td>
                    {/* Producto */}
                    <td className={`${cellPad} ${cellText} text-text-secondary`}>{contract.product}</td>
                    {/* ARR Actual */}
                    <td className={`${cellPad} ${cellText} text-right font-mono font-medium text-text-primary`}>
                      {contract.current_price_annual > 0 ? formatCurrency(contract.current_price_annual) : <span className="text-text-dimmed font-normal">--</span>}
                    </td>
                    {/* MRR */}
                    <td className={`${cellPad} ${cellText} text-right font-mono text-text-secondary`}>
                      {contract.current_mrr > 0 ? formatCurrency(contract.current_mrr) : <span className="text-text-dimmed">--</span>}
                    </td>
                    {/* Renovación */}
                    <td className={`${cellPad} ${cellText} ${renewal.className}`}>{renewal.text}</td>
                    {/* Owner */}
                    <td className={`${cellPad}`}>
                      <div className="flex justify-center">
                        <OwnerAvatar name={contract.account_owner} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedContracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-text-dimmed">
                    No se encontraron contratos con los filtros actuales
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-default bg-bg-surface/50">
                <td colSpan={3} className={`${cellPad} ${cellText} font-semibold text-text-primary`}>
                  Total ({sortedContracts.length} contratos)
                </td>
                <td className={`${cellPad} ${cellText} text-right font-mono font-semibold text-text-primary`}>
                  {formatCurrency(totals.currentArr)}
                </td>
                <td className={`${cellPad} ${cellText} text-right font-mono font-semibold text-text-secondary`}>
                  {formatCurrency(totals.mrr)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── Drawer ─── */}
      {selectedContract && (
        <ContractDetailDrawer
          contract={selectedContract}
          events={contractEvents.filter((e) => e.contract_id === selectedContract.contract_id)}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  );
}
