'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  formatCurrency,
  formatPercent,
  formatMonth,
  getMRRMetrics,
} from '@/lib/data';
import { calculateForecast } from '@/lib/forecast';
import { calculateBurnRate, calculateRunway, calculateAvgMonthlyInflow, calculateNetBurn } from '@/lib/cashflow';
import { Invoice, Contract, CashBalance, Expense, BankInflow, MRRMetric } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CONCENTRATION_COLORS = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#db2777', '#6366f1', '#14b8a6', '#f59e0b',
];

const CHART_COLORS = {
  primary: '#4f46e5',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
};

export default function Overview() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [cashBalance, setCashBalance] = useState<CashBalance | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inflows, setInflows] = useState<BankInflow[]>([]);
  const [mrrData, setMrrData] = useState<MRRMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, contractsData, cashData, expensesData, inflowsData, mrrMetrics] = await Promise.all([
          getInvoices(),
          getContracts(),
          getCashBalance(),
          getExpenses(),
          getInflows(),
          getMRRMetrics(),
        ]);
        setInvoices(invoicesData);
        setContracts(contractsData);
        setCashBalance(cashData);
        setExpenses(expensesData);
        setInflows(inflowsData);
        setMrrData(mrrMetrics);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const today = new Date();

    const activeContracts = contracts.filter(c => c.status === 'activo');
    const pipelineContracts = contracts.filter(c => c.status === 'negociación');

    // SALUD FINANCIERA
    const ytdInvoices = invoices.filter(inv => inv.invoice_year === currentYear);
    const ingresosYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
    const arrActual = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    
    const sixMonthsAgo = mrrData.length >= 7 ? mrrData[mrrData.length - 7] : null;
    const arrSixMonthsAgo = sixMonthsAgo ? sixMonthsAgo.arr_approx : 0;
    const arrGrowth = arrSixMonthsAgo > 0 ? ((arrActual - arrSixMonthsAgo) / arrSixMonthsAgo) * 100 : 0;

    const currentBalance = cashBalance?.current_balance || 0;
    const burnRate = Math.abs(calculateBurnRate(expenses, 6));
    const avgMonthlyInflow = calculateAvgMonthlyInflow(inflows, 6);
    const netBurn = calculateNetBurn(burnRate, avgMonthlyInflow);
    const runway = calculateRunway(currentBalance, netBurn);

    // GROWTH & RISK
    const mrrLast6Months = mrrData.slice(-6).map(d => ({
      month: formatMonth(d.month),
      mrr: d.mrr_approx,
    }));

    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const contractsAtRisk = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const endDate = new Date(c.end_date);
      return endDate <= ninetyDaysFromNow && endDate >= today;
    });
    const arrEnRiesgo = contractsAtRisk.reduce((sum, c) => sum + c.current_price_annual, 0);
    const pipelineARR = pipelineContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const churnPendiente = 0;

    // EFICIENCIA OPERATIVA
    const facturasConPago = invoices.filter(
      inv => inv.status === 'paid' && inv.days_to_pay !== null && inv.days_to_pay !== undefined
    );
    const dso = facturasConPago.length > 0
      ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
      : 0;

    const facturasPendientes = invoices.filter(inv => inv.status !== 'paid');
    const importePendiente = facturasPendientes.reduce((sum, inv) => sum + inv.amount_net, 0);
    const totalFacturadoYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);
    const porcentajePendiente = totalFacturadoYTD > 0 ? (importePendiente / totalFacturadoYTD) * 100 : 0;

    const facturasYTD = ytdInvoices.length;
    const facturasPagadasYTD = ytdInvoices.filter(inv => inv.status === 'paid').length;
    const collectionRate = facturasYTD > 0 ? (facturasPagadasYTD / facturasYTD) * 100 : 0;

    // CUSTOMER OVERVIEW
    const fourMonthsAgo = new Date(today);
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const recentInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      return invDate >= fourMonthsAgo;
    });
    const clientesActivos = new Set(recentInvoices.map(inv => inv.customer_name)).size;

    const fiveMonthsAgo = new Date(today);
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    const previousMonthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      return invDate >= fiveMonthsAgo && invDate < fourMonthsAgo;
    });
    const clientesPrevMonth = new Set(previousMonthInvoices.map(inv => inv.customer_name)).size;
    const clientesDelta = clientesActivos - clientesPrevMonth;

    const arrTotal = activeContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const clientConcentration = activeContracts
      .filter(c => c.current_price_annual > 0)
      .map(c => ({
        name: c.client_name,
        arr: c.current_price_annual,
        percentage: arrTotal > 0 ? (c.current_price_annual / arrTotal) * 100 : 0,
      }))
      .sort((a, b) => b.arr - a.arr)
      .slice(0, 5);

    const recurringYTD = ytdInvoices
      .filter(inv => inv.revenue_category === 'recurring')
      .reduce((sum, inv) => sum + inv.amount_net, 0);
    const porcentajeRecurrente = ingresosYTD > 0 ? (recurringYTD / ingresosYTD) * 100 : 0;

    return {
      ingresosYTD, arrActual, arrGrowth, currentBalance, runway, netBurn, burnRate,
      mrrLast6Months, arrEnRiesgo, pipelineARR, churnPendiente,
      dso, importePendiente, porcentajePendiente, collectionRate,
      clientesActivos, clientesDelta, clientConcentration, porcentajeRecurrente, arrTotal,
      currentYear,
    };
  }, [invoices, contracts, cashBalance, expenses, inflows, mrrData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Executive Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Vista consolidada de métricas críticas</p>
      </div>

      {/* SECCIÓN 1: SALUD FINANCIERA GENERAL */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Salud Financiera General
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Revenue YTD</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.ingresosYTD)}</p>
            <p className="mt-1 text-xs text-text-muted">{metrics.currentYear}</p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">ARR Actual</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.arrActual)}</p>
            {metrics.arrGrowth !== 0 && (
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-medium ${metrics.arrGrowth >= 0 ? 'text-success' : 'text-danger'}`}>
                  {metrics.arrGrowth >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(metrics.arrGrowth))}
                </span>
                <span className="text-xs text-text-dimmed">vs 6 meses atrás</span>
              </div>
            )}
          </div>

          <div className={`rounded-xl border p-4 ${
            metrics.runway < 6 ? 'border-danger/30 bg-danger/5' :
            metrics.runway < 12 ? 'border-warning/30 bg-warning/5' :
            'border-border-subtle bg-bg-surface'
          }`}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Runway</p>
            <p className={`mt-2 text-2xl font-bold ${
              metrics.runway < 6 ? 'text-danger' :
              metrics.runway < 12 ? 'text-warning' : 'text-success'
            }`}>
              {metrics.runway.toFixed(1)} meses
            </p>
            <p className="mt-1 text-xs text-text-muted">Net Burn: {formatCurrency(metrics.netBurn)}/mes</p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Cash Balance</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.currentBalance)}</p>
            <p className="mt-1 text-xs text-text-muted">Actual</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: GROWTH & RISK */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">Growth & Risk</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              MRR Growth (últimos 6 meses)
            </p>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.mrrLast6Months} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" stroke={CHART_COLORS.text} fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke={CHART_COLORS.text} fontSize={9} tickLine={false} axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '6px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="mrr" stroke={CHART_COLORS.primary}
                    strokeWidth={1.5} fill="url(#mrrGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl border p-4 ${
              metrics.arrEnRiesgo > 0 ? 'border-danger/30 bg-danger/5' : 'border-border-subtle bg-bg-surface'
            }`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">ARR en Riesgo</p>
              <p className={`mt-2 text-xl font-bold ${metrics.arrEnRiesgo > 0 ? 'text-danger' : 'text-success'}`}>
                {metrics.arrEnRiesgo > 0 ? formatCurrency(metrics.arrEnRiesgo) : '€0'}
              </p>
              <p className="mt-1 text-[10px] text-text-dimmed">Vence en &lt;90 días</p>
            </div>

            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Pipeline ARR</p>
              <p className="mt-2 text-xl font-bold text-accent">{formatCurrency(metrics.pipelineARR)}</p>
              <p className="mt-1 text-[10px] text-text-dimmed">En negociación</p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Churn Pendiente</p>
              <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(metrics.churnPendiente)}</p>
              <p className="mt-1 text-[10px] text-text-dimmed">De eventos de cancelación</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: EFICIENCIA OPERATIVA */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Eficiencia Operativa
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">DSO</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{Math.round(metrics.dso)} días</p>
            <p className="mt-1 text-xs text-text-muted">Days Sales Outstanding</p>
          </div>

          <div className={`rounded-xl border p-4 ${
            metrics.porcentajePendiente > 20 ? 'border-warning/30 bg-warning/5' : 'border-border-subtle bg-bg-surface'
          }`}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Cobros Pendientes</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.importePendiente)}</p>
            <p className="mt-1 text-xs text-text-muted">{formatPercent(metrics.porcentajePendiente)} del facturado</p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Collection Rate</p>
            <p className="mt-2 text-2xl font-bold text-success">{formatPercent(metrics.collectionRate)}</p>
            <p className="mt-1 text-xs text-text-muted">% facturas pagadas YTD</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: CUSTOMER OVERVIEW */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Customer Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Clientes Activos</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-text-primary">{metrics.clientesActivos}</p>
              {metrics.clientesDelta !== 0 && (
                <span className={`text-sm font-medium ${metrics.clientesDelta > 0 ? 'text-success' : 'text-danger'}`}>
                  {metrics.clientesDelta > 0 ? '+' : ''}{metrics.clientesDelta}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-text-muted">vs mes anterior</p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">% Revenue Recurring</p>
            <p className="mt-2 text-2xl font-bold text-accent">{formatPercent(metrics.porcentajeRecurrente)}</p>
            <p className="mt-1 text-xs text-text-muted">Del total YTD</p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Concentración (Top 5)
            </p>
            <div className="space-y-1.5">
              {metrics.clientConcentration.map((client, index) => (
                <div key={client.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CONCENTRATION_COLORS[index] }} />
                    <span className="text-text-muted truncate max-w-[120px]">
                      {client.name.split(' ')[0]}
                    </span>
                  </div>
                  <span className="font-mono text-text-primary font-medium">
                    {formatPercent(client.percentage)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-bg-muted/50 px-4 py-3">
        <p className="text-[10px] text-text-dimmed">
          <strong>Runway:</strong> Meses hasta agotamiento de caja basado en Net Burn actual.
          <strong className="ml-3">DSO:</strong> Promedio calculado sobre facturas cobradas.
          <strong className="ml-3">ARR en Riesgo:</strong> Contratos expirando en &lt;90 días.
        </p>
      </div>
    </div>
  );
}
