'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  getInvoices,
  getContracts,
  getCashBalance,
  getExpenses,
  getInflows,
  getFinancing,
  getUsageMetrics,
  formatCurrency,
  formatPercent,
  getMRRMetrics,
} from '@/lib/data';
import { calculateCashflowMetrics, getExpensesByCategoryFiltered } from '@/lib/cashflow';
import { Invoice, Contract, CashBalance, Expense, BankInflow, MRRMetric, FinancingData, EquityRound, DebtInstrument, Grant, UsageMetrics } from '@/types';
import { ExportReportModal } from '@/components/ExportReportModal';
import type { ReportPreset, ReportOptions } from '@/components/ExportReportModal';

const CONCENTRATION_COLORS = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706',
];

const EXPENSE_COLORS = [
  '#4f46e5', // 1º - accent (mayor peso)
  '#7c3aed', // 2º - violet
  '#0891b2', // 3º - cyan
  '#059669', // 4º - emerald
  '#d97706', // 5º - amber
  '#94a3b8', // 6º - slate
  '#64748b', // 7º - fallback
];

export default function Overview() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [cashBalance, setCashBalance] = useState<CashBalance | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inflows, setInflows] = useState<BankInflow[]>([]);
  const [mrrData, setMrrData] = useState<MRRMetric[]>([]);
  const [financing, setFinancing] = useState<FinancingData | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoicesData, contractsData, cashData, expensesData, inflowsData, mrrMetrics, financingData, usageData] = await Promise.all([
          getInvoices(),
          getContracts(),
          getCashBalance(),
          getExpenses(),
          getInflows(),
          getMRRMetrics(),
          getFinancing(),
          getUsageMetrics(),
        ]);
        setInvoices(invoicesData);
        setContracts(contractsData);
        setCashBalance(cashData);
        setExpenses(expensesData);
        setInflows(inflowsData);
        setMrrData(mrrMetrics);
        setFinancing(financingData);
        setUsageMetrics(usageData);
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
    const priorFiscalYear = currentYear - 1;
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12

    // === SECTION 1: REVENUE ===
    const revenuePriorFY = invoices
      .filter(inv => inv.invoice_year === priorFiscalYear)
      .reduce((sum, inv) => sum + inv.amount_net, 0);

    const ytdInvoices = invoices.filter(inv => inv.invoice_year === currentYear);
    const revenueYTD = ytdInvoices.reduce((sum, inv) => sum + inv.amount_net, 0);

    const currentQuarter = Math.ceil(currentMonth / 3);
    let lastCompleteQuarterLabel: string;
    if (currentQuarter === 1) {
      lastCompleteQuarterLabel = `${priorFiscalYear}Q4`;
    } else {
      lastCompleteQuarterLabel = `${currentYear}Q${currentQuarter - 1}`;
    }
    const revenueLastQuarter = invoices
      .filter(inv => inv.invoice_quarter === lastCompleteQuarterLabel)
      .reduce((sum, inv) => sum + inv.amount_net, 0);

    const lastCompleteMonth = currentMonth === 1
      ? { year: currentYear - 1, month: 12 }
      : { year: currentYear, month: currentMonth - 1 };
    const lastCompleteMonthLabel = new Date(lastCompleteMonth.year, lastCompleteMonth.month - 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const revenueLastMonth = invoices
      .filter(inv =>
        inv.invoice_year === lastCompleteMonth.year &&
        inv.invoice_month === lastCompleteMonth.month
      )
      .reduce((sum, inv) => sum + inv.amount_net, 0);

    // FY prior-prior (para variación)
    const priorPriorFiscalYear = priorFiscalYear - 1;
    const revenuePriorPriorFY = invoices
      .filter(inv => inv.invoice_year === priorPriorFiscalYear)
      .reduce((sum, inv) => sum + inv.amount_net, 0);
    const varFY = revenuePriorPriorFY > 0
      ? ((revenuePriorFY - revenuePriorPriorFY) / revenuePriorPriorFY) * 100
      : null;

    // YTD del año anterior (mismo rango de meses) para variación
    const ytdPriorYear = invoices
      .filter(inv => inv.invoice_year === priorFiscalYear && inv.invoice_month <= currentMonth)
      .reduce((sum, inv) => sum + inv.amount_net, 0);
    const varYTD = ytdPriorYear > 0
      ? ((revenueYTD - ytdPriorYear) / ytdPriorYear) * 100
      : null;

    const activeContracts = contracts.filter(c => c.status === 'activo');
    const currentMRR = mrrData.length > 0 ? mrrData[mrrData.length - 1].mrr_approx : 0;
    const currentARR = currentMRR * 12;

    // === SECTION 2: CLIENTS & USAGE ===
    const totalUniqueClients = new Set(invoices.map(inv => inv.customer_name)).size;
    const clientesRecurrentes = activeContracts.length;

    const clientConcentration = activeContracts
      .filter(c => c.current_price_annual > 0)
      .map(c => ({
        name: c.client_name,
        arr: c.current_price_annual,
        percentage: currentARR > 0 ? (c.current_price_annual / currentARR) * 100 : 0,
      }))
      .sort((a, b) => b.arr - a.arr)
      .slice(0, 5);

    const top5ConcentrationPercent = clientConcentration
      .reduce((sum, c) => sum + c.percentage, 0);

    // === SECTION 3: PIPELINE ARR ===
    const pipelineContracts = contracts.filter(c => c.status === 'negociación');
    const pipelineARR = pipelineContracts.reduce((sum, c) => sum + c.current_price_annual, 0);
    const pipelineCount = pipelineContracts.length;

    // === SECTION 4: CASH ===
    const currentBalance = cashBalance?.current_balance || 0;
    const cfMetrics = cashBalance ? calculateCashflowMetrics(expenses, inflows, cashBalance, 6) : null;
    const burnRate = cfMetrics?.burnRate || 0;
    const netBurn = cfMetrics?.netBurn || 0;
    const runway = cfMetrics?.runwayMonths === -1 ? Infinity : (cfMetrics?.runwayMonths || 0);

    // === SECTION 5: FINANCIACIÓN (from financing.json) ===
    const totalEquity = financing
      ? financing.equity_rounds.reduce((sum, e) => sum + e.amount, 0)
      : 0;
    const totalDebt = financing
      ? financing.debt.reduce((sum, d) => sum + d.amount, 0)
      : 0;
    const totalGrants = financing
      ? financing.grants.reduce((sum, g) => sum + g.amount, 0)
      : 0;

    // === SECTION 6: EFICIENCIA OPERATIVA ===
    const facturasConPago = invoices.filter(
      inv => inv.status === 'paid' && inv.days_to_pay !== null && inv.days_to_pay !== undefined
    );
    const dso = facturasConPago.length > 0
      ? facturasConPago.reduce((sum, inv) => sum + (inv.days_to_pay || 0), 0) / facturasConPago.length
      : 0;

    const facturasYTD = ytdInvoices.length;
    const facturasPagadasYTD = ytdInvoices.filter(inv => inv.status === 'paid').length;
    const collectionRate = facturasYTD > 0 ? (facturasPagadasYTD / facturasYTD) * 100 : 0;

    const recurringYTD = ytdInvoices
      .filter(inv => inv.revenue_category === 'recurring')
      .reduce((sum, inv) => sum + inv.amount_net, 0);
    const porcentajeRecurrente = revenueYTD > 0 ? (recurringYTD / revenueYTD) * 100 : 0;

    // === SECTION 7: DISTRIBUCIÓN DE GASTOS ===
    const expensesByCategory = getExpensesByCategoryFiltered(expenses, 12);

    // === SECTION 2b: USAGE METRICS (from GPTadvisor screenshots) ===
    const usageTotalUsers = usageMetrics?.latest?.total_users ?? null;
    const usageAvgDailyChats = usageMetrics?.latest?.avg_daily_conversations ?? null;
    const usageReportDate = usageMetrics?.latest?.date ?? null;

    return {
      // Revenue
      revenuePriorFY, revenueYTD, revenueLastQuarter, revenueLastMonth,
      lastCompleteQuarterLabel, lastCompleteMonthLabel,
      currentARR, currentMRR, currentYear, priorFiscalYear,
      varFY, varYTD, priorPriorFiscalYear,
      // Clients
      totalUniqueClients, clientesRecurrentes, clientConcentration, top5ConcentrationPercent,
      // Usage
      usageTotalUsers, usageAvgDailyChats, usageReportDate,
      // Pipeline
      pipelineContracts, pipelineARR, pipelineCount,
      // Cash
      currentBalance, burnRate, netBurn, runway,
      // Financing
      totalEquity, totalDebt, totalGrants,
      // Efficiency
      dso, collectionRate, porcentajeRecurrente,
      // Expenses
      expensesByCategory,
    };
  }, [invoices, contracts, cashBalance, expenses, inflows, mrrData, financing, usageMetrics]);

  const handleGenerateReport = async (preset: ReportPreset, options: ReportOptions) => {
    setShowExportModal(false);
    setGeneratingPDF(true);
    try {
      if (options.blocks) {
        // Custom block report (Fase 2)
        const { generateBlockReport } = await import('@/lib/pdf-block-report');
        await generateBlockReport(options.customNote, options.blocks);
      } else if (preset === 'investors') {
        const { generateVCReport } = await import('@/lib/vc-report-pdf');
        await generateVCReport(
          options.period!,
          options.customNote,
          options.manualMRR!,
          options.manualARR!
        );
      } else if (preset === 'management') {
        const { generateManagementReport } = await import('@/lib/management-report-pdf');
        await generateManagementReport(options.customNote);
      } else {
        // full report
        const { generateExecutiveReport } = await import('@/lib/report-pdf');
        await generateExecutiveReport();
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = [...new Set(invoices.map((inv) => inv.invoice_year))];
    return years.sort((a, b) => b - a);
  }, [invoices]);

  const availableQuarters = useMemo(() => {
    const quarters = [...new Set(invoices.map((inv) => inv.invoice_quarter))];
    const quarterNames: Record<string, string> = { '1': 'Jan–Mar', '2': 'Apr–Jun', '3': 'Jul–Sep', '4': 'Oct–Dec' };
    return quarters
      .sort()
      .reverse()
      .map((q) => {
        const [year, qNum] = q.split('Q');
        return { year: Number(year), quarter: Number(qNum), label: `Q${qNum} ${year} (${quarterNames[qNum]})` };
      });
  }, [invoices]);

  const mrrDefault = useMemo(() => {
    if (mrrData.length === 0) return 0;
    return mrrData[mrrData.length - 1].mrr_approx;
  }, [mrrData]);

  const arrDefault = useMemo(() => {
    if (mrrData.length === 0) return 0;
    return mrrData[mrrData.length - 1].mrr_approx * 12;
  }, [mrrData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Executive Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Vista consolidada de métricas críticas</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          disabled={generatingPDF || loading}
          className="flex items-center gap-1 sm:gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generatingPDF ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* === SECCIÓN 1: REVENUE === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Revenue
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Columna izquierda: Revenue Performance */}
          <div className="lg:col-span-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Revenue Performance
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Revenue FY {metrics.priorFiscalYear}</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.revenuePriorFY)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-text-muted">vs FY {metrics.priorPriorFiscalYear}</span>
                  {metrics.varFY !== null && (
                    <span className={`text-xs font-semibold ${metrics.varFY >= 0 ? 'text-success' : 'text-danger'}`}>
                      {metrics.varFY >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(metrics.varFY))}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Revenue YTD</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.revenueYTD)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-text-muted">{metrics.currentYear}</span>
                  {metrics.varYTD !== null && (
                    <span className={`text-xs font-semibold ${metrics.varYTD >= 0 ? 'text-success' : 'text-danger'}`}>
                      {metrics.varYTD >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(metrics.varYTD))}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Revenue {metrics.lastCompleteQuarterLabel}</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.revenueLastQuarter)}</p>
                <p className="mt-1 text-xs text-text-muted">Último trimestre completo</p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Revenue último mes</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.revenueLastMonth)}</p>
                <p className="mt-1 text-xs text-text-muted capitalize">{metrics.lastCompleteMonthLabel}</p>
              </div>
            </div>
          </div>

          {/* Columna derecha: Recurring Metrics */}
          <div>
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Recurring Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 group relative">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">ARR Actual</p>
                  <span className="text-text-dimmed/50 cursor-help" title="ARR = MRR × 12. MRR se calcula como la suma de facturación neta recurrente del último mes (licencias recurrentes incluyendo coste por uso).">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-accent">{formatCurrency(metrics.currentARR)}</p>
                <p className="mt-1 text-xs text-text-muted">MRR × 12</p>
                {/* Tooltip expandido en hover */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-[10px] text-text-muted shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <p className="font-medium text-text-primary mb-1">ARR = MRR × 12</p>
                  <p>MRR se calcula como la suma neta de facturas recurrentes del último mes (licencias recurrentes incluyendo coste por uso).</p>
                </div>
              </div>

              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 group relative">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">MRR Actual</p>
                  <span className="text-text-dimmed/50 cursor-help" title="MRR = suma de amount_net de todas las facturas recurring del último mes con datos. Incluye licencias recurrentes y coste por uso.">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-accent">{formatCurrency(metrics.currentMRR)}</p>
                <p className="mt-1 text-xs text-text-muted">Último mes con datos</p>
                {/* Tooltip expandido en hover */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-[10px] text-text-muted shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <p className="font-medium text-text-primary mb-1">MRR = Σ amount_net (recurring)</p>
                  <p>Suma de facturación neta de todas las facturas recurrentes del último mes. Incluye licencias recurrentes y coste por uso.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === SECCIÓN 2: CLIENTS & USAGE === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Clients & Usage
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Columna 1: Clients */}
          <div>
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Clients
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Total Clientes</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{metrics.totalUniqueClients}</p>
                <p className="mt-1 text-xs text-text-muted">Alguna vez facturados</p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Clientes Recurrentes</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{metrics.clientesRecurrentes}</p>
                <p className="mt-1 text-xs text-text-muted">Contratos activos</p>
              </div>
            </div>
          </div>

          {/* Columna 2: Usage */}
          <div>
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Usage
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              {metrics.usageTotalUsers !== null ? (
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Nº Users</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{metrics.usageTotalUsers.toLocaleString('es-ES')}</p>
                  <p className="mt-1 text-[10px] text-text-dimmed">
                    Report {metrics.usageReportDate ? new Date(metrics.usageReportDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface/30 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Nº Users</p>
                  <p className="mt-2 text-xl font-bold text-text-muted/50">--</p>
                  <p className="mt-1 text-[10px] text-text-dimmed italic">Pendiente: ejecutar ingest:usage</p>
                </div>
              )}

              {metrics.usageAvgDailyChats !== null ? (
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Daily Chats</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{metrics.usageAvgDailyChats.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</p>
                  <p className="mt-1 text-[10px] text-text-dimmed">Promedio diario YTD</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface/30 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Daily Chats</p>
                  <p className="mt-2 text-xl font-bold text-text-muted/50">--</p>
                  <p className="mt-1 text-[10px] text-text-dimmed italic">Pendiente: ejecutar ingest:usage</p>
                </div>
              )}
            </div>
          </div>

          {/* Columna 3: Concentración ARR */}
          <div>
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Concentración ARR
            </h3>
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 h-full md:h-auto">
              <div className="space-y-3">
                {metrics.clientConcentration.map((client, index) => (
                  <div key={client.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
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
                    <div className="h-1 rounded-full bg-bg-muted">
                      <div className="h-1 rounded-full" style={{
                        width: `${client.percentage}%`,
                        backgroundColor: CONCENTRATION_COLORS[index]
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 pt-2 border-t border-border-subtle text-[10px] text-text-dimmed">
                Top 5: <span className="font-medium text-accent">{formatPercent(metrics.top5ConcentrationPercent)}</span> del ARR
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === SECCIÓN 3: PIPELINE ARR === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Pipeline ARR
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Columna izquierda: Resumen Pipeline */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 flex flex-col justify-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Total Pipeline ARR</p>
            <p className="mt-2 text-3xl font-bold text-accent">{formatCurrency(metrics.pipelineARR)}</p>
            <p className="mt-2 text-xs text-text-muted">
              {metrics.pipelineCount} deal{metrics.pipelineCount !== 1 ? 's' : ''} en negociación
            </p>
          </div>

          {/* Columna derecha: Lista de deals */}
          <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-bg-surface p-4">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed mb-3">
              Deals en negociación
            </h3>
            {metrics.pipelineContracts.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {metrics.pipelineContracts
                  .sort((a: Contract, b: Contract) => b.current_price_annual - a.current_price_annual)
                  .map((c: Contract) => (
                    <div key={c.contract_id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary font-medium">{c.client_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-bg-muted text-text-dimmed">{c.product}</span>
                      </div>
                      <span className="font-mono text-sm text-text-primary whitespace-nowrap font-medium">
                        {formatCurrency(c.current_price_annual)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Sin deals en pipeline</p>
            )}
          </div>
        </div>
      </div>

      {/* === SECCIÓN 4: CASH === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Cash
        </h2>
        <div className="space-y-3 sm:space-y-4">
          {/* Fila superior: Runway + Cash Balance (KPIs principales) */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
            <div className={`rounded-xl border p-5 ${
              metrics.runway < 6 ? 'border-danger/30 bg-danger/5' :
              metrics.runway < 12 ? 'border-warning/30 bg-warning/5' :
              'border-success/20 bg-success/5'
            }`}>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${
                  metrics.runway < 6 ? 'bg-danger' :
                  metrics.runway < 12 ? 'bg-warning' : 'bg-success'
                }`} />
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Runway</p>
              </div>
              <p className={`mt-2 text-3xl font-bold ${
                metrics.runway < 6 ? 'text-danger' :
                metrics.runway < 12 ? 'text-warning' : 'text-success'
              }`}>
                {isFinite(metrics.runway) ? `${metrics.runway.toFixed(1)} meses` : '∞'}
              </p>
              <p className="mt-1 text-xs text-text-muted">Meses de caja restante</p>
            </div>

            <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Cash Balance</p>
              <p className="mt-2 text-2xl font-bold text-accent">{formatCurrency(metrics.currentBalance)}</p>
              <p className="mt-1 text-xs text-text-muted">Saldo actual</p>
            </div>
          </div>

          {/* Fila inferior: Burn Rate + Net Burn (métricas secundarias) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border border-border-subtle bg-bg-muted/50 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Burn Rate</p>
              <p className="mt-2 text-2xl font-bold text-text-secondary">{formatCurrency(metrics.burnRate)}</p>
              <p className="mt-1 text-xs text-text-muted">Gasto medio/mes (6M)</p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-muted/50 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">Net Burn</p>
              <p className="mt-2 text-2xl font-bold text-text-secondary">{formatCurrency(metrics.netBurn)}</p>
              <p className="mt-1 text-xs text-text-muted">Burn - Ingresos/mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Separador visual: bloque core (1-4) → bloque complementario (5-7) */}
      <div className="border-t border-border-subtle" />

      {/* === SECCIÓN 5: FINANCIACIÓN === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Financiación
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Equity */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">
              Equity (Seed Round)
            </p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.totalEquity)}</p>
            {financing && financing.equity_rounds.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-border-subtle pt-2">
                {financing.equity_rounds
                  .sort((a: EquityRound, b: EquityRound) => b.amount - a.amount)
                  .map((entry: EquityRound) => (
                  <div key={entry.investor} className="flex items-center justify-between text-[10px]">
                    <span className="text-text-muted truncate mr-2">{entry.investor}</span>
                    <span className="font-mono text-text-primary whitespace-nowrap">{formatCurrency(entry.amount)}</span>
                  </div>
                ))}
                <p className="text-[10px] text-text-dimmed mt-1">
                  Instrumento: CLA · {new Date(financing.equity_rounds[0].date).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Deuda */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">
              Deuda
            </p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.totalDebt)}</p>
            {financing && financing.debt.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-border-subtle pt-2">
                {financing.debt.map((entry: DebtInstrument) => (
                  <div key={entry.instrument}>
                    <p className="text-[10px] text-text-muted truncate">
                      {entry.instrument} ({entry.institution})
                    </p>
                    <div className="flex items-center justify-between text-[10px] mt-0.5">
                      <span className="text-text-dimmed">
                        {new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-mono text-text-primary">{formatCurrency(entry.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subvenciones */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">
              Subvenciones
            </p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(metrics.totalGrants)}</p>
            {financing && financing.grants.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border-subtle pt-2">
                {financing.grants
                  .sort((a: Grant, b: Grant) => b.amount - a.amount)
                  .map((entry: Grant) => (
                  <div key={entry.name} className="flex items-center justify-between text-[10px]">
                    <span className="text-text-muted truncate mr-2">
                      {entry.name} ({entry.institution})
                      {' · '}
                      {new Date(entry.date).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                    </span>
                    <span className="font-mono text-text-primary whitespace-nowrap">{formatCurrency(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === SECCIÓN 6: EFICIENCIA OPERATIVA === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Operational Efficiency
        </h2>
        <div className="rounded-xl border border-border-subtle bg-bg-muted/30 p-4">
          {/* Desktop: stat-row horizontal con dividers */}
          <div className="hidden sm:grid sm:grid-cols-3">
            <div className="pr-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">DSO</p>
              <p className="mt-1 text-2xl font-bold text-text-secondary">{Math.round(metrics.dso)} días</p>
              <p className="mt-1 text-xs text-text-muted">Days Sales Outstanding</p>
            </div>

            <div className="border-l border-border-subtle px-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">% Facturas Cobradas</p>
              <p className="mt-1 text-2xl font-bold text-success">{formatPercent(metrics.collectionRate)}</p>
              <p className="mt-1 text-xs text-text-muted">Facturas pagadas YTD</p>
            </div>

            <div className="border-l border-border-subtle pl-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">% Ingresos Recurrentes</p>
              <p className="mt-1 text-2xl font-bold text-accent">{formatPercent(metrics.porcentajeRecurrente)}</p>
              <p className="mt-1 text-xs text-text-muted">Del total YTD</p>
            </div>
          </div>

          {/* Mobile: stack vertical con dividers horizontales */}
          <div className="sm:hidden space-y-3">
            <div className="pb-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">DSO</p>
              <p className="mt-1 text-2xl font-bold text-text-secondary">{Math.round(metrics.dso)} días</p>
              <p className="mt-1 text-xs text-text-muted">Days Sales Outstanding</p>
            </div>

            <div className="border-t border-border-subtle pt-3 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">% Facturas Cobradas</p>
              <p className="mt-1 text-2xl font-bold text-success">{formatPercent(metrics.collectionRate)}</p>
              <p className="mt-1 text-xs text-text-muted">Facturas pagadas YTD</p>
            </div>

            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">% Ingresos Recurrentes</p>
              <p className="mt-1 text-2xl font-bold text-accent">{formatPercent(metrics.porcentajeRecurrente)}</p>
              <p className="mt-1 text-xs text-text-muted">Del total YTD</p>
            </div>
          </div>
        </div>
      </div>

      {/* === SECCIÓN 7: DISTRIBUCIÓN DE GASTOS === */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dimmed mb-4">
          Distribution of Expenses <span className="normal-case font-normal tracking-normal text-text-muted">(últimos 12 meses)</span>
        </h2>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
          <div className="space-y-3">
            {metrics.expensesByCategory.map((cat, index) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-dimmed w-4">{index + 1}.</span>
                    <span className={index === 0 ? 'text-text-primary font-semibold' : 'text-text-secondary font-medium'}>
                      {cat.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-text-primary">
                      {formatCurrency(cat.total)}
                    </span>
                    <span className="text-text-dimmed w-12 text-right">
                      {formatPercent(cat.percentage)}
                    </span>
                  </div>
                </div>
                <div className={`${index === 0 ? 'h-2' : 'h-1.5'} rounded-full bg-bg-muted ml-6`}>
                  <div
                    className={`${index === 0 ? 'h-2' : 'h-1.5'} rounded-full`}
                    style={{
                      width: `${Math.min(Math.abs(cat.percentage), 100)}%`,
                      backgroundColor: EXPENSE_COLORS[index] || '#64748b'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER - GLOSSARY */}
      <div className="rounded-lg border border-border-subtle bg-bg-muted/50 px-4 py-3">
        <p className="text-[10px] text-text-dimmed">
          <strong>Runway:</strong> Meses hasta agotamiento de caja basado en Net Burn actual.
          <strong className="ml-1 sm:ml-3">DSO:</strong> Promedio calculado sobre facturas cobradas.
          <strong className="ml-1 sm:ml-3">MRR:</strong> Suma neta de facturas recurrentes del último mes (licencias + uso).
          <strong className="ml-1 sm:ml-3">ARR:</strong> MRR × 12.
        </p>
      </div>

      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onGenerate={handleGenerateReport}
        availableYears={availableYears}
        availableQuarters={availableQuarters}
        mrrDefault={mrrDefault}
        arrDefault={arrDefault}
        generating={generatingPDF}
      />
    </div>
  );
}
