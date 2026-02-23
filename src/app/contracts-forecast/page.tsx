'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  KPICard,
  ChartContainer,
  ARRByClientChart,
  ARRByProductChart,
  ExpansionByClientChart,
  EventImpactChart,
} from '@/components';
import {
  getInvoices,
  getContracts,
  getContractEvents,
  formatCurrency,
  formatPercent,
} from '@/lib/data';
import { calculateForecast } from '@/lib/forecast';
import { Invoice, Contract, ContractEvent, ForecastData } from '@/types';

type Tab = 'overview' | 'expansion';

export default function RecurringRevenuePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, contractsData, eventsData] = await Promise.all([
          getInvoices(),
          getContracts(),
          getContractEvents(),
        ]);
        setInvoices(invoicesData);
        setContracts(contractsData);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Contract KPIs
  const contractKpis = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === 'activo');
    const negotiationContracts = contracts.filter(c => c.status === 'negociación');

    const arrBase = activeContracts.reduce((sum, c) => sum + c.base_arr_eur, 0);
    const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const expansion = arrActual - arrBase;
    const churnFromEvents = events
      .filter(e => e.event_type === 'CANCELACIÓN')
      .reduce((sum, e) => sum + Math.abs(e.arr_delta), 0);
    const pipeline = negotiationContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const activeCount = activeContracts.length;
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

  // Upcoming renewals (90 days)
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

  // All events sorted by date (no limit)
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  }, [events]);

  // Forecast data (for MRR client table)
  const forecast: ForecastData | null = useMemo(() => {
    if (invoices.length === 0 || contracts.length === 0) return null;
    return calculateForecast(contracts, invoices);
  }, [invoices, contracts]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-border-subtle overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          ARR Overview
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('expansion')}
          className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'expansion'
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Expansion & Retention
          {activeTab === 'expansion' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ARR OVERVIEW TAB                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Hero KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <KPICard
              label="Current ARR"
              value={formatCurrency(contractKpis.arrActual)}
              subtitle={`Base: ${formatCurrency(contractKpis.arrBase)}`}
            />
            <KPICard
              label="Current MRR"
              value={formatCurrency(forecast?.totalMRR ?? contractKpis.arrActual / 12)}
              subtitle={`From ${contractKpis.activeCount} active contracts`}
            />
            <KPICard
              label="Recurring Clients"
              value={String(contractKpis.uniqueClients)}
              subtitle={`${contractKpis.activeCount} active contracts`}
            />
            <KPICard
              label="Pipeline ARR"
              value={formatCurrency(contractKpis.pipeline)}
              subtitle={`${contractKpis.negotiationCount} deals in negotiation`}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartContainer
              title="ARR by Client"
              subtitle="Top 10 clients by contractual ARR"
            >
              <ARRByClientChart contracts={contracts} />
            </ChartContainer>

            <ChartContainer
              title="ARR by Product"
              subtitle="Contractual ARR distribution"
            >
              <ARRByProductChart contracts={contracts} />
            </ChartContainer>
          </div>

          {/* Client MRR Detail Table (absorbed from forecast tab) */}
          {forecast && (
            <div className="rounded-xl border border-border-subtle bg-bg-surface/50 overflow-hidden">
              <div className="px-5 py-4">
                <h3 className="text-sm font-medium text-text-secondary">Client MRR Detail</h3>
                <p className="text-xs text-text-dimmed mt-1">
                  Estimated MRR based on last invoice or contract value
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-t border-border-subtle">
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        Frequency
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        Last Invoice
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        MRR
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-medium text-text-dimmed uppercase tracking-wider">
                        % Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.clients.map((client, index) => (
                      <tr
                        key={`${client.clientId}-${client.contractName}`}
                        className={`transition-colors hover:bg-bg-hover ${index !== 0 ? 'border-t border-border-subtle' : ''}`}
                      >
                        <td className="px-5 py-3 text-sm text-text-primary font-medium">
                          {client.clientName}
                        </td>
                        <td className="px-5 py-3 text-sm text-text-muted">
                          {client.contractName}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            client.billingFrequency === 'trimestral'
                              ? 'bg-tertiary/10 text-tertiary'
                              : client.billingFrequency === 'anual'
                              ? 'bg-accent/10 text-accent'
                              : 'bg-text-dimmed/10 text-text-muted'
                          }`}>
                            {client.billingFrequency === 'mensual' ? 'monthly' :
                             client.billingFrequency === 'trimestral' ? 'quarterly' : 'annual'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-text-muted">
                          {client.lastInvoiceDate
                            ? new Date(client.lastInvoiceDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: '2-digit',
                              })
                            : <span className="text-text-dimmed italic">No invoice</span>
                          }
                          {client.source === 'contrato' && (
                            <span className="ml-1 text-[10px] text-text-dimmed">(contract)</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-mono text-text-primary font-medium">
                          {formatCurrency(client.mrrEstimado)}
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-text-muted">
                          {formatPercent(client.percentOfTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border-default bg-bg-surface/50">
                      <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-text-primary">
                        Total
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono font-semibold text-text-primary">
                        {formatCurrency(forecast.totalMRR)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-text-muted">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Compact Context Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">FY{forecast?.fiscalYear ?? new Date().getFullYear()} Estimate</p>
              <p className="mt-1.5 text-lg font-semibold text-accent">
                {forecast ? formatCurrency(forecast.totalEstimadoFY) : '—'}
              </p>
              <p className="text-[10px] text-text-dimmed">
                {forecast ? `Billed YTD: ${formatCurrency(forecast.facturadoYTD)} + ${forecast.mesesRestantesFY}m forecast` : ''}
              </p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Upcoming Renewals</p>
              <p className="mt-1.5 text-lg font-semibold text-warning">
                {upcomingRenewals.length}
              </p>
              <p className="text-[10px] text-text-dimmed">Within next 90 days</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-dimmed">Contractual Churn</p>
              <p className="mt-1.5 text-lg font-semibold text-danger">
                {formatCurrency(contractKpis.churnFromEvents)}
              </p>
              <p className="text-[10px] text-text-dimmed">From registered cancellations</p>
            </div>
          </div>

          {/* Upcoming Renewals */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Upcoming Renewals (90 days)</h3>
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-text-muted">No upcoming renewals</p>
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
                        {new Date(c.end_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* EXPANSION & RETENTION TAB                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'expansion' && (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
            <KPICard
              label="Net Expansion"
              value={formatCurrency(contractKpis.expansion - contractKpis.churnFromEvents)}
              subtitle="Expansion minus churn"
            />
            <KPICard
              label="Total Expansion"
              value={formatCurrency(contractKpis.expansion)}
              subtitle={`${contractKpis.arrBase > 0 ? ((contractKpis.expansion / contractKpis.arrBase) * 100).toFixed(1) : '0.0'}% of base ARR`}
            />
            <KPICard
              label="Contractual Churn"
              value={formatCurrency(contractKpis.churnFromEvents)}
              subtitle="Registered cancellations"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Expansion by Client"
              subtitle="Clients with highest contractual growth"
            >
              <ExpansionByClientChart contracts={contracts} />
            </ChartContainer>

            <ChartContainer
              title="Expansion vs Cancellation"
              subtitle="Impact of contractual events"
            >
              <EventImpactChart events={events} />
            </ChartContainer>
          </div>

          {/* All Events Timeline */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface/30 p-4">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Contract Events</h3>
            {sortedEvents.length === 0 ? (
              <p className="text-sm text-text-muted">No events registered</p>
            ) : (
              <div className="space-y-2">
                {sortedEvents.map(e => (
                  <div
                    key={e.event_id}
                    className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/50 px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{e.client_name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          e.event_type === 'EXPANSION' || e.event_type === 'NEW_BUSINESS'
                            ? 'bg-success/10 text-success'
                            : e.event_type === 'CANCELACIÓN'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {e.event_type}
                        </span>
                      </div>
                      <p className="text-xs text-text-dimmed">{e.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${e.arr_delta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {e.arr_delta >= 0 ? '+' : ''}{formatCurrency(e.arr_delta)}
                      </p>
                      <p className="text-xs text-text-dimmed">
                        {new Date(e.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
