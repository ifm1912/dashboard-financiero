'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  KPICard,
  ChartContainer,
  ARRByClientChart,
  ARRByProductChart,
  ExpansionByClientChart,
  EventImpactChart,
  ARRByOwnerChart,
} from '@/components';
import { getContracts, getContractEvents, formatCurrency } from '@/lib/data';
import { Contract, ContractEvent } from '@/types';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [contractsData, eventsData] = await Promise.all([
          getContracts(),
          getContractEvents(),
        ]);
        setContracts(contractsData);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calcular KPIs contractuales
  const kpis = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === 'activo');
    const negotiationContracts = contracts.filter(c => c.status === 'negociación');

    // ARR Base (suma de base_arr_eur de contratos activos)
    const arrBase = activeContracts.reduce((sum, c) => sum + c.base_arr_eur, 0);

    // ARR Actual (suma de current_price_annual de contratos activos)
    const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);

    // Expansión contractual
    const expansion = arrActual - arrBase;

    // Churn de eventos (suma de cancelaciones)
    const churnFromEvents = events
      .filter(e => e.event_type === 'CANCELACIÓN')
      .reduce((sum, e) => sum + Math.abs(e.arr_delta), 0);

    // Pipeline (contratos en negociación)
    const pipeline = negotiationContracts.reduce((sum, c) => sum + c.current_price_annual, 0);

    // Conteo de contratos activos
    const activeCount = activeContracts.length;

    // Clientes únicos con contratos activos
    const uniqueClients = new Set(activeContracts.map(c => c.client_id)).size;

    return {
      arrBase,
      arrActual,
      expansion,
      churnFromEvents,
      pipeline,
      activeCount,
      uniqueClients,
      negotiationCount: negotiationContracts.length,
    };
  }, [contracts, events]);

  // Renovaciones próximas (próximos 90 días)
  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    const in90Days = new Date();
    in90Days.setDate(today.getDate() + 90);

    return contracts
      .filter(c => {
        if (c.status !== 'activo' || !c.end_date) return false;
        const endDate = new Date(c.end_date);
        return endDate >= today && endDate <= in90Days;
      })
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
  }, [contracts]);

  // Timeline de eventos recientes
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())
      .slice(0, 5);
  }, [events]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard
          label="ARR Contractual Base"
          value={formatCurrency(kpis.arrBase)}
          subtitle="Sin IPC ni expansiones"
        />
        <KPICard
          label="ARR Contractual Actual"
          value={formatCurrency(kpis.arrActual)}
          subtitle="Base + IPC + Expansiones"
        />
        <KPICard
          label="Expansión Contractual"
          value={formatCurrency(kpis.expansion)}
          subtitle={`${((kpis.expansion / kpis.arrBase) * 100).toFixed(1)}% sobre base`}
        />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Contratos Recurrentes</p>
          <p className="mt-1.5 text-xl font-semibold text-text-primary">{kpis.activeCount}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Clientes Recurrentes</p>
          <p className="mt-1.5 text-xl font-semibold text-text-primary">{kpis.uniqueClients}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Churn</p>
          <p className="mt-1.5 text-xl font-semibold text-danger">{formatCurrency(kpis.churnFromEvents)}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Pipeline</p>
          <p className="mt-1.5 text-xl font-semibold text-warning">{formatCurrency(kpis.pipeline)}</p>
          <p className="text-[10px] text-text-dimmed">{kpis.negotiationCount} en negociación</p>
        </div>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer
          title="ARR por Cliente"
          subtitle="Top 10 clientes por ARR contractual"
        >
          <ARRByClientChart contracts={contracts} />
        </ChartContainer>

        <ChartContainer
          title="ARR por Producto"
          subtitle="Distribución del ARR contractual"
        >
          <ARRByProductChart contracts={contracts} />
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Expansión por Cliente"
          subtitle="Clientes con mayor crecimiento contractual"
        >
          <ExpansionByClientChart contracts={contracts} />
        </ChartContainer>

        <ChartContainer
          title="Expansión vs Cancelación"
          subtitle="Impacto de eventos contractuales"
        >
          <EventImpactChart events={events} />
        </ChartContainer>
      </div>

      {/* Portfolio por Owner */}
      <ChartContainer
        title="Portfolio por Account Owner"
        subtitle="ARR contractual por responsable"
      >
        <ARRByOwnerChart contracts={contracts} />
      </ChartContainer>

      {/* Tablas de información */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Renovaciones próximas */}
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Renovaciones Próximas (90 días)</h3>
          {upcomingRenewals.length === 0 ? (
            <p className="text-sm text-text-muted">Sin renovaciones próximas</p>
          ) : (
            <div className="space-y-2">
              {upcomingRenewals.map(c => (
                <div
                  key={c.contract_id}
                  className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{c.client_name}</p>
                    <p className="text-xs text-text-dimmed">{c.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-text-primary">{formatCurrency(c.current_price_annual)}</p>
                    <p className="text-xs text-warning">
                      {new Date(c.end_date!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eventos recientes */}
        <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Eventos Recientes</h3>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-text-muted">Sin eventos registrados</p>
          ) : (
            <div className="space-y-2">
              {recentEvents.map(e => (
                <div
                  key={e.event_id}
                  className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{e.client_name}</p>
                    <p className="text-xs text-text-dimmed">{e.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${e.arr_delta >= 0 ? 'text-success' : 'text-danger'}`}>
                      {e.arr_delta >= 0 ? '+' : ''}{formatCurrency(e.arr_delta)}
                    </p>
                    <p className="text-xs text-text-dimmed">
                      {new Date(e.effective_from).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
