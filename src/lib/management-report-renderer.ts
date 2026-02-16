import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ManagementReportData, formatCurrency, formatPercent, formatShortMonth } from './management-report-data';
import {
  C,
  M,
  PW,
  CW,
  drawHeader,
  drawSectionTitle,
  drawKPI,
  drawKPIRow,
  addPageNumbers,
  tableDefaults,
  getTableEndY,
  shortCurrency,
  CATEGORY_COLORS,
  type RGB,
} from './pdf-renderer';
import {
  drawStackedBarChart,
  drawGroupedBarChart,
  drawHorizontalBarChart,
} from './pdf-charts';

// ===========================
// PAGE 1: Revenue · Clients · Usage
// ===========================

function renderPage1(doc: jsPDF, data: ManagementReportData) {
  drawHeader(doc, 'Revenue & Clients', {
    reportTitle: 'GPTadvisor — Management Report',
    reportDate: data.reportDate,
    subtitle: data.reportMonth,
  });

  let y = M.top + 20;

  // --- Custom note ---
  if (data.customNote.trim()) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textPrimary);

    const lines = doc.splitTextToSize(data.customNote.trim(), CW);
    doc.text(lines, M.left, y);
    y += lines.length * 3.8 + 6;
  }

  // --- Section: Revenue Performance ---
  y = drawSectionTitle(doc, 'Revenue Performance', y);

  y = drawKPIRow(doc, y, [
    { label: `Revenue FY${String(data.fiscalYear - 1).slice(-2)}`, value: formatCurrency(data.revenuePriorFY), subtitle: `FY ${data.fiscalYear - 1}` },
    { label: 'Revenue YTD', value: formatCurrency(data.revenueYTD), subtitle: `FY ${data.fiscalYear}` },
    { label: `Revenue ${data.lastCompleteQuarterLabel}`, value: formatCurrency(data.revenueLastQuarter), subtitle: 'Último trimestre' },
    { label: 'Revenue mes', value: formatCurrency(data.revenueLastMonth), subtitle: data.lastCompleteMonthLabel },
  ]);

  y += 3;

  // --- Section: Recurring Metrics ---
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

  y += 3;

  // --- CHART: Revenue mensual (stacked bar) ---
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

  y += 3;

  // --- Section: Clients & Usage ---
  y = drawSectionTitle(doc, 'Clients & Usage', y);

  const clientKPIs: { label: string; value: string; subtitle?: string }[] = [
    { label: 'Total Clientes', value: String(data.totalClients), subtitle: 'Historial completo' },
    { label: 'Clientes Recurrentes', value: String(data.recurringClients), subtitle: 'Con contrato activo' },
  ];

  if (data.usageTotalUsers !== null) {
    clientKPIs.push({
      label: 'Total Users',
      value: data.usageTotalUsers.toLocaleString('es-ES'),
      subtitle: data.usageReportDate ? `Report ${data.usageReportDate}` : undefined,
    });
  }

  if (data.usageAvgDailyChats !== null) {
    clientKPIs.push({
      label: 'Daily Chats',
      value: data.usageAvgDailyChats.toLocaleString('es-ES', { maximumFractionDigits: 1 }),
      subtitle: 'Promedio diario YTD',
    });
  }

  y = drawKPIRow(doc, y, clientKPIs, clientKPIs.length);

  // --- Client Concentration Table ---
  if (data.clientConcentration.length > 0) {
    y += 3;
    y = drawSectionTitle(doc, 'Concentración de Clientes (Top 5 por ARR)', y);
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
  }
}

// ===========================
// PAGE 2: Cash · Expenses · Efficiency
// ===========================

function renderPage2(doc: jsPDF, data: ManagementReportData) {
  drawHeader(doc, 'Cash & Efficiency', {
    reportTitle: 'GPTadvisor — Management Report',
    reportDate: data.reportDate,
    subtitle: data.reportMonth,
  });

  let y = M.top + 20;

  // --- Section: Cash & Runway ---
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

  y += 3;

  // --- CHART: Cash Flow mensual (grouped bar) ---
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

  y += 3;

  // --- CHART: Expenses by Category (horizontal bars) ---
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

  y += 3;

  // --- Section: Operational Efficiency ---
  y = drawSectionTitle(doc, 'Eficiencia Operativa', y);
  y = drawKPIRow(doc, y, [
    { label: 'DSO', value: `${Math.round(data.dso)} días`, subtitle: 'Days Sales Outstanding' },
    { label: 'Collection Rate', value: formatPercent(data.collectionRate), subtitle: 'Facturas pagadas YTD' },
    { label: '% Recurrente', value: formatPercent(data.recurringPercentage), subtitle: 'Del revenue YTD' },
  ], 3);
}

// ===========================
// Public API
// ===========================

export function renderManagementReport(data: ManagementReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  renderPage1(doc, data);
  doc.addPage();
  renderPage2(doc, data);

  addPageNumbers(doc);

  return doc;
}
