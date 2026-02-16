/**
 * Block-based PDF renderer.
 * Renders a dynamic list of blocks with automatic pagination.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BlockReportData, formatCurrency, formatPercent, formatShortMonth } from './pdf-block-data';
import { ReportBlock, BLOCK_HEIGHTS } from './pdf-blocks';
import {
  C,
  M,
  PW,
  CW,
  drawHeader,
  drawSectionTitle,
  drawKPIRow,
  addPageNumbers,
  tableDefaults,
  getTableEndY,
  CATEGORY_COLORS,
  type RGB,
} from './pdf-renderer';
import {
  drawStackedBarChart,
  drawGroupedBarChart,
  drawBarLineCombo,
  drawHorizontalBarChart,
} from './pdf-charts';

const PAGE_BOTTOM = 297 - M.bottom - 10; // Leave room for page numbers

interface HeaderConfig {
  title: string;
  subtitle: string;
}

// ===========================
// Main entry point
// ===========================

export function renderBlockReport(
  data: BlockReportData,
  blocks: ReportBlock[],
  headerConfig: HeaderConfig
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // First page header
  drawHeader(doc, 'Custom Report', {
    reportTitle: headerConfig.title,
    reportDate: data.reportDate,
    subtitle: headerConfig.subtitle,
  });

  let y = M.top + 20;

  // Custom note
  if (data.customNote.trim()) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textPrimary);
    const lines = doc.splitTextToSize(data.customNote.trim(), CW);
    doc.text(lines, M.left, y);
    y += lines.length * 3.8 + 6;
  }

  // Render each block
  for (const block of blocks) {
    const estimatedH = BLOCK_HEIGHTS[block];

    // If it won't fit, start new page
    if (y + estimatedH > PAGE_BOTTOM) {
      doc.addPage();
      drawHeader(doc, 'Custom Report', {
        reportTitle: headerConfig.title,
        reportDate: data.reportDate,
        subtitle: headerConfig.subtitle,
      });
      y = M.top + 20;
    }

    y = renderBlock(doc, y, data, block);
    y += 4;
  }

  addPageNumbers(doc);
  return doc;
}

// ===========================
// Block dispatcher
// ===========================

function renderBlock(doc: jsPDF, y: number, data: BlockReportData, block: ReportBlock): number {
  switch (block) {
    case 'REVENUE_PERFORMANCE': return renderRevenuePerformance(doc, y, data);
    case 'RECURRING_METRICS':   return renderRecurringMetrics(doc, y, data);
    case 'REVENUE_CHART':       return renderRevenueChart(doc, y, data);
    case 'MRR_TREND':           return renderMRRTrend(doc, y, data);
    case 'CLIENTS_CONCENTRATION': return renderClientsConcentration(doc, y, data);
    case 'USAGE':               return renderUsage(doc, y, data);
    case 'PIPELINE':            return renderPipeline(doc, y, data);
    case 'CASH_RUNWAY':         return renderCashRunway(doc, y, data);
    case 'CASHFLOW_CHART':      return renderCashflowChart(doc, y, data);
    case 'EXPENSES':            return renderExpenses(doc, y, data);
    case 'FINANCING':           return renderFinancing(doc, y, data);
    case 'EFFICIENCY':          return renderEfficiency(doc, y, data);
    case 'CONTRACTS':           return renderContracts(doc, y, data);
    case 'FORECAST':            return renderForecast(doc, y, data);
    case 'ALERTS':              return renderAlerts(doc, y, data);
    default:                    return y;
  }
}

// ===========================
// Individual block renderers
// ===========================

function renderRevenuePerformance(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Revenue Performance', y);
  y = drawKPIRow(doc, y, [
    { label: `Revenue FY${String(data.fiscalYear - 1).slice(-2)}`, value: formatCurrency(data.revenuePriorFY), subtitle: `FY ${data.fiscalYear - 1}` },
    { label: 'Revenue YTD', value: formatCurrency(data.revenueYTD), subtitle: `FY ${data.fiscalYear}` },
    { label: `Revenue ${data.lastCompleteQuarterLabel}`, value: formatCurrency(data.revenueLastQuarter), subtitle: 'Último trimestre' },
    { label: 'Revenue mes', value: formatCurrency(data.revenueLastMonth), subtitle: data.lastCompleteMonthLabel },
  ]);
  return y;
}

function renderRecurringMetrics(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Recurring Metrics', y);
  y = drawKPIRow(doc, y, [
    {
      label: 'ARR Actual',
      value: formatCurrency(data.currentARR),
      subtitle: data.arrGrowth !== 0 ? `${data.arrGrowth >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(data.arrGrowth))} vs 6m` : undefined,
      subtitleColor: data.arrGrowth >= 0 ? C.success : C.danger,
    },
    { label: 'MRR Actual', value: formatCurrency(data.currentMRR) },
    { label: '% Recurrente', value: formatPercent(data.recurringPercentage), subtitle: 'Del revenue YTD' },
  ], 3);
  return y;
}

function renderRevenueChart(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Ingresos Mensuales (Últimos 6 Meses)', y);
  y = drawStackedBarChart(
    doc, M.left, y, CW, 48,
    data.monthlyRevenue.map(m => ({
      label: formatShortMonth(m.month),
      values: [m.recurring, m.nonRecurring],
      total: m.total,
    })),
    [C.accent, C.success],
    ['Recurrente', 'No Recurrente']
  );
  return y;
}

function renderMRRTrend(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Evolución MRR / ARR', y);
  y = drawBarLineCombo(
    doc, M.left, y, CW, 52,
    data.mrrTrend.map(m => ({
      label: formatShortMonth(m.month),
      bar: m.mrr,
      line: m.arr,
    })),
    C.accent, C.success,
    'MRR', 'ARR'
  );
  return y;
}

function renderClientsConcentration(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Clients & Concentration', y);
  y = drawKPIRow(doc, y, [
    { label: 'Total Clientes', value: String(data.totalClients), subtitle: 'Historial completo' },
    { label: 'Clientes Recurrentes', value: String(data.recurringClients), subtitle: 'Con contrato activo' },
    { label: 'Clientes Activos', value: String(data.clientesActivos), subtitle: 'Últimos 4 meses' },
  ], 3);

  if (data.clientConcentration.length > 0) {
    y += 2;
    autoTable(doc, {
      ...tableDefaults(y),
      head: [['Cliente', 'ARR', '% del Total']],
      body: data.clientConcentration.map(c => [
        c.name,
        formatCurrency(c.arr),
        formatPercent(c.percentage),
      ]),
      columnStyles: {
        1: { halign: 'right' as const },
        2: { halign: 'right' as const },
      },
    });
    y = getTableEndY(doc) + 4;
  }
  return y;
}

function renderUsage(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Usage Metrics', y);

  const kpis: { label: string; value: string; subtitle?: string }[] = [];

  if (data.usageTotalUsers !== null) {
    kpis.push({
      label: 'Total Users',
      value: data.usageTotalUsers.toLocaleString('es-ES'),
      subtitle: data.usageReportDate ? `Report ${data.usageReportDate}` : undefined,
    });
  }

  if (data.usageAvgDailyChats !== null) {
    kpis.push({
      label: 'Daily Chats',
      value: data.usageAvgDailyChats.toLocaleString('es-ES', { maximumFractionDigits: 1 }),
      subtitle: 'Promedio diario YTD',
    });
  }

  if (kpis.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.textMuted);
    doc.text('Datos de uso no disponibles', M.left, y + 3);
    return y + 10;
  }

  y = drawKPIRow(doc, y, kpis, kpis.length);
  return y;
}

function renderPipeline(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Pipeline ARR', y);
  y = drawKPIRow(doc, y, [
    { label: 'Pipeline ARR', value: formatCurrency(data.pipelineARR) },
    { label: 'Deals Near Closing', value: String(data.pipelineCount), subtitle: 'In negotiation' },
  ], 2);

  if (data.pipelineClientNames.length > 0) {
    y += 1;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.textMuted);
    const clientList = data.pipelineClientNames.join(', ');
    const pipelineLines = doc.splitTextToSize(`Clients near closing: ${clientList}`, CW);
    doc.text(pipelineLines, M.left, y);
    y += pipelineLines.length * 3.5 + 5;
  }

  return y;
}

function renderCashRunway(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Cash & Runway', y);

  const runwayText = isFinite(data.runway) ? `${Math.round(data.runway)} meses` : 'Indefinido';
  const runwayColor: RGB = data.runway < 6 ? C.danger : data.runway < 12 ? C.warning : C.success;

  y = drawKPIRow(doc, y, [
    { label: 'Cash Balance', value: formatCurrency(data.cashBalance) },
    { label: 'Burn Rate', value: `${formatCurrency(data.burnRate)}/mes`, subtitle: 'Media últimos 6 meses' },
    {
      label: 'Net Burn',
      value: `${formatCurrency(data.netBurn)}/mes`,
      subtitleColor: data.netBurn > 0 ? C.danger : C.success,
      subtitle: data.netBurn > 0 ? 'Quemando caja' : 'Generando caja',
    },
    {
      label: 'Runway',
      value: runwayText,
      subtitleColor: runwayColor,
    },
  ]);
  return y;
}

function renderCashflowChart(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Cash Flow Mensual (Últimos 6 Meses)', y);
  y = drawGroupedBarChart(
    doc, M.left, y, CW, 50,
    data.cashflowMonthly.map(m => ({
      label: formatShortMonth(m.month),
      values: [m.inflow, m.outflow],
    })),
    [C.success, C.danger],
    ['Cobros', 'Gastos']
  );
  return y;
}

function renderExpenses(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Distribución de Gastos por Categoría (12 Meses)', y);
  const expenseChartH = Math.max(28, data.expensesByCategory.length * 8 + 8);
  y = drawHorizontalBarChart(
    doc, M.left, y, CW, expenseChartH,
    data.expensesByCategory.map((e, i) => ({
      label: e.category,
      value: e.total,
      displayValue: `${formatCurrency(e.total)} (${formatPercent(e.percentage)})`,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    })),
    C.accent
  );
  return y;
}

function renderFinancing(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Financiación Obtenida', y);

  const gap = 4;
  const cardW = (CW - gap) / 2;
  const cardH = 38;

  data.financiacion.forEach((item, i) => {
    const x = M.left + i * (cardW + gap);

    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    doc.setFillColor(...C.accent);
    doc.roundedRect(x, y, cardW, 3, 2, 2, 'F');
    doc.rect(x, y + 1.5, cardW, 1.5, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.accent);
    doc.text(item.label, x + 5, y + 10);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(formatCurrency(item.amount), x + 5, y + 21);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textMuted);
    doc.text(item.detail, x + 5, y + 28);
  });

  y += cardH + 6;

  const totalFinancing = data.financiacion.reduce((sum, f) => sum + f.amount, 0);
  y = drawKPIRow(doc, y, [
    { label: 'Total Financiación', value: formatCurrency(totalFinancing), subtitle: 'Subvenciones + Préstamos' },
  ], 1);

  return y;
}

function renderEfficiency(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Eficiencia Operativa', y);
  y = drawKPIRow(doc, y, [
    { label: 'DSO', value: `${Math.round(data.dso)} días`, subtitle: 'Days Sales Outstanding' },
    { label: 'Collection Rate', value: formatPercent(data.collectionRate), subtitle: 'Facturas pagadas YTD' },
    { label: '% Recurrente', value: formatPercent(data.recurringPercentage), subtitle: 'Del revenue YTD' },
  ], 3);
  return y;
}

function renderContracts(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Portfolio de Contratos', y);

  const expansionPct = data.arrBase > 0 ? (data.expansion / data.arrBase) * 100 : 0;
  y = drawKPIRow(doc, y, [
    { label: 'ARR Base', value: formatCurrency(data.arrBase) },
    {
      label: 'ARR Actual',
      value: formatCurrency(data.arrActual),
      subtitle: `Expansión: +${formatPercent(expansionPct)}`,
      subtitleColor: C.success,
    },
    { label: 'Churn', value: formatCurrency(data.churn), subtitleColor: C.danger },
    { label: 'Pipeline ARR', value: formatCurrency(data.pipelineARR) },
  ]);

  if (data.upcomingRenewals.length > 0) {
    y += 2;
    y = drawSectionTitle(doc, 'Renovaciones Próximas (90 Días)', y);
    autoTable(doc, {
      ...tableDefaults(y),
      head: [['Cliente', 'Producto', 'ARR', 'Vencimiento']],
      body: data.upcomingRenewals.map(r => [
        r.client,
        r.product,
        formatCurrency(r.arr),
        new Date(r.endDate).toLocaleDateString('es-ES'),
      ]),
      columnStyles: {
        2: { halign: 'right' as const },
      },
    });
    y = getTableEndY(doc) + 4;
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.success);
    doc.text('Sin renovaciones próximas', M.left, y + 3);
    y += 10;
  }

  return y;
}

function renderForecast(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Forecast de Ingresos', y);

  const forecastAlphas: RGB[] = [
    C.accent,
    C.accentLight,
    [129, 140, 248],
    [165, 180, 252],
  ];
  y = drawHorizontalBarChart(
    doc, M.left, y, CW, 32,
    [
      { label: 'M+1', value: data.forecastM1, displayValue: formatCurrency(data.forecastM1), color: forecastAlphas[0] },
      { label: 'M+3', value: data.forecastM3, displayValue: formatCurrency(data.forecastM3), color: forecastAlphas[1] },
      { label: 'M+6', value: data.forecastM6, displayValue: formatCurrency(data.forecastM6), color: forecastAlphas[2] },
      { label: 'M+12', value: data.forecastM12, displayValue: formatCurrency(data.forecastM12), color: forecastAlphas[3] },
    ],
    C.accent
  );

  y = drawSectionTitle(doc, `Vista FY ${data.fiscalYear}`, y);
  y = drawKPIRow(doc, y, [
    { label: 'Facturado YTD', value: formatCurrency(data.facturadoYTD) },
    { label: 'Forecast Restante', value: formatCurrency(data.forecastRestanteFY) },
    { label: 'Total Estimado FY', value: formatCurrency(data.totalEstimadoFY) },
  ], 3);

  return y;
}

function renderAlerts(doc: jsPDF, y: number, data: BlockReportData): number {
  y = drawSectionTitle(doc, 'Alertas Clave', y);

  const alertRows: string[][] = [];
  if (data.contractsAtRisk.length > 0) {
    data.contractsAtRisk.forEach(c => {
      alertRows.push([
        'Contrato por vencer',
        `${c.client} — ${c.product}`,
        formatCurrency(c.arr),
        new Date(c.endDate).toLocaleDateString('es-ES'),
      ]);
    });
  }
  if (data.pendingAmount > 0) {
    alertRows.push([
      'Cobros pendientes',
      `${formatPercent(data.pendingPercentage)} de facturación YTD`,
      formatCurrency(data.pendingAmount),
      '',
    ]);
  }

  if (alertRows.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.success);
    doc.text('Sin alertas pendientes', M.left, y + 3);
    return y + 10;
  }

  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Tipo', 'Detalle', 'Importe', 'Fecha']],
    body: alertRows,
    columnStyles: {
      0: { cellWidth: 35 },
      2: { halign: 'right' as const, cellWidth: 30 },
      3: { cellWidth: 25 },
    },
  });
  return getTableEndY(doc) + 4;
}
