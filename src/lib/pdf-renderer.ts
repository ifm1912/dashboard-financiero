import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExecutiveReportData, formatCurrency, formatPercent, formatShortMonth } from './report-data';

// Design system colors (RGB tuples)
const C = {
  accent:      [79, 70, 229]   as [number, number, number],
  textPrimary: [15, 23, 42]    as [number, number, number],
  textMuted:   [100, 116, 139] as [number, number, number],
  textDimmed:  [148, 163, 184] as [number, number, number],
  success:     [22, 163, 74]   as [number, number, number],
  danger:      [220, 38, 38]   as [number, number, number],
  warning:     [202, 138, 4]   as [number, number, number],
  bgMuted:     [241, 245, 249] as [number, number, number],
  bgBase:      [248, 250, 252] as [number, number, number],
  border:      [226, 232, 240] as [number, number, number],
  white:       [255, 255, 255] as [number, number, number],
};

const M = { left: 15, right: 15, top: 20, bottom: 15 };
const PW = 210; // A4 width in mm
const CW = PW - M.left - M.right; // content width

// autoTable theme shared across all tables
function tableDefaults(startY: number) {
  return {
    startY,
    margin: { left: M.left, right: M.right },
    headStyles: {
      fillColor: C.bgMuted,
      textColor: C.textMuted,
      fontStyle: 'bold' as const,
      fontSize: 7.5,
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: C.textPrimary,
      fontSize: 8,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: C.bgBase,
    },
    footStyles: {
      fillColor: C.bgMuted,
      textColor: C.accent,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    tableLineColor: C.border,
    tableLineWidth: 0.1,
    styles: {
      lineColor: C.border,
      lineWidth: 0.1,
    },
  };
}

function drawHeader(doc: jsPDF, title: string, data: ExecutiveReportData) {
  // Company & report title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.accent);
  doc.text('Informe Ejecutivo Mensual', M.left, M.top);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text(`Generado: ${data.reportDate}`, PW - M.right, M.top, { align: 'right' });

  // Subtitle with month
  doc.setFontSize(10);
  doc.setTextColor(...C.textPrimary);
  const capitalizedMonth = data.reportMonth.charAt(0).toUpperCase() + data.reportMonth.slice(1);
  doc.text(capitalizedMonth, M.left, M.top + 6);

  // Page-specific title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textDimmed);
  doc.text(title.toUpperCase(), M.left, M.top + 13);

  // Divider
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.5);
  doc.line(M.left, M.top + 15, PW - M.right, M.top + 15);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textDimmed);
  doc.text(title.toUpperCase(), M.left, y);
  return y + 5;
}

// Draw a KPI box (rounded rect with label + value + optional subtitle)
function drawKPI(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, subtitle?: string, subtitleColor?: [number, number, number]
) {
  // Background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Label
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textDimmed);
  doc.text(label.toUpperCase(), x + 4, y + 6);

  // Value
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textPrimary);
  doc.text(value, x + 4, y + 14);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...(subtitleColor || C.textMuted));
    doc.text(subtitle, x + 4, y + 19);
  }
}

function drawKPIRow(
  doc: jsPDF, y: number,
  kpis: { label: string; value: string; subtitle?: string; subtitleColor?: [number, number, number] }[],
  count: number = 4
) {
  const gap = 4;
  const kpiW = (CW - gap * (count - 1)) / count;
  const kpiH = 23;
  kpis.forEach((kpi, i) => {
    drawKPI(doc, M.left + i * (kpiW + gap), y, kpiW, kpiH, kpi.label, kpi.value, kpi.subtitle, kpi.subtitleColor);
  });
  return y + kpiH + 4;
}

function getTableEndY(doc: jsPDF): number {
  // jspdf-autotable stores last Y position
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 0;
}

// ===========================
// PAGE 1: Executive Summary
// ===========================

function renderPage1(doc: jsPDF, data: ExecutiveReportData) {
  drawHeader(doc, 'Resumen Ejecutivo', data);
  let y = M.top + 20;

  // Financial Health KPIs
  y = drawSectionTitle(doc, 'Salud Financiera', y);

  const runwayText = isFinite(data.runway) ? `${Math.round(data.runway)} meses` : 'Indefinido';
  const runwayColor: [number, number, number] = data.runway < 6 ? C.danger : data.runway < 12 ? C.warning : C.success;

  y = drawKPIRow(doc, y, [
    { label: 'Revenue YTD', value: formatCurrency(data.revenueYTD), subtitle: `FY ${data.fiscalYear}` },
    {
      label: 'ARR Actual',
      value: formatCurrency(data.arrActual),
      subtitle: data.arrGrowth !== 0 ? `${data.arrGrowth >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(data.arrGrowth))} vs 6m` : undefined,
      subtitleColor: data.arrGrowth >= 0 ? C.success : C.danger,
    },
    { label: 'Caja Actual', value: formatCurrency(data.cashBalance) },
    {
      label: 'Runway',
      value: runwayText,
      subtitle: `Net Burn: ${formatCurrency(data.netBurn)}/mes`,
      subtitleColor: runwayColor,
    },
  ]);

  y += 4;

  // Alerts
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
    y += 10;
  } else {
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
    y = getTableEndY(doc) + 6;
  }

  // Operational Summary
  y = drawSectionTitle(doc, 'Resumen Operativo', y);
  y = drawKPIRow(doc, y, [
    { label: 'Clientes Activos', value: String(data.clientesActivos) },
    { label: '% Recurrente', value: formatPercent(data.recurringPercentage) },
    { label: 'DSO', value: `${Math.round(data.dso)} días` },
    { label: 'Collection Rate', value: formatPercent(data.collectionRate) },
  ]);

  // Client Concentration
  y += 4;
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

// ===========================
// PAGE 2: Revenue & Growth
// ===========================

function renderPage2(doc: jsPDF, data: ExecutiveReportData) {
  drawHeader(doc, 'Ingresos y Crecimiento', data);
  let y = M.top + 20;

  // Monthly Revenue Table
  y = drawSectionTitle(doc, 'Ingresos Mensuales (Últimos 6 Meses)', y);

  const totalRec = data.monthlyRevenue.reduce((s, m) => s + m.recurring, 0);
  const totalNonRec = data.monthlyRevenue.reduce((s, m) => s + m.nonRecurring, 0);

  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Mes', 'Recurrente', 'No Recurrente', 'Total']],
    body: data.monthlyRevenue.map(m => [
      formatShortMonth(m.month),
      formatCurrency(m.recurring),
      formatCurrency(m.nonRecurring),
      formatCurrency(m.total),
    ]),
    foot: [['Total', formatCurrency(totalRec), formatCurrency(totalNonRec), formatCurrency(totalRec + totalNonRec)]],
    columnStyles: {
      1: { halign: 'right' as const },
      2: { halign: 'right' as const },
      3: { halign: 'right' as const },
    },
  });
  y = getTableEndY(doc) + 8;

  // MRR/ARR Trend
  y = drawSectionTitle(doc, 'Evolución MRR / ARR', y);
  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Mes', 'MRR', 'ARR']],
    body: data.mrrTrend.map(m => [
      formatShortMonth(m.month),
      formatCurrency(m.mrr),
      formatCurrency(m.arr),
    ]),
    columnStyles: {
      1: { halign: 'right' as const },
      2: { halign: 'right' as const },
    },
  });
  y = getTableEndY(doc) + 8;

  // Efficiency KPIs
  y = drawSectionTitle(doc, 'Eficiencia Operativa', y);
  y = drawKPIRow(doc, y, [
    { label: 'DSO', value: `${Math.round(data.dso)} días` },
    { label: 'Collection Rate', value: formatPercent(data.collectionRate) },
    { label: 'Pendiente Cobro', value: formatCurrency(data.pendingAmount), subtitle: `${formatPercent(data.pendingPercentage)} del YTD` },
  ], 3);

  y += 4;

  // Forecast
  y = drawSectionTitle(doc, 'Forecast de Ingresos', y);
  autoTable(doc, {
    ...tableDefaults(y),
    head: [['M+1', 'M+3', 'M+6', 'M+12']],
    body: [[
      formatCurrency(data.forecastM1),
      formatCurrency(data.forecastM3),
      formatCurrency(data.forecastM6),
      formatCurrency(data.forecastM12),
    ]],
    columnStyles: {
      0: { halign: 'center' as const },
      1: { halign: 'center' as const },
      2: { halign: 'center' as const },
      3: { halign: 'center' as const },
    },
  });
  y = getTableEndY(doc) + 6;

  // FY summary
  y = drawSectionTitle(doc, `Vista FY ${data.fiscalYear}`, y);
  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Facturado YTD', 'Forecast Restante', 'Total Estimado FY']],
    body: [[
      formatCurrency(data.facturadoYTD),
      formatCurrency(data.forecastRestanteFY),
      formatCurrency(data.totalEstimadoFY),
    ]],
    columnStyles: {
      0: { halign: 'center' as const },
      1: { halign: 'center' as const },
      2: { halign: 'center' as const },
    },
  });
}

// ===========================
// PAGE 3: Cash Flow
// ===========================

function renderPage3(doc: jsPDF, data: ExecutiveReportData) {
  drawHeader(doc, 'Tesorería y Cash Flow', data);
  let y = M.top + 20;

  // Burn KPIs
  y = drawSectionTitle(doc, 'Análisis de Burn', y);
  y = drawKPIRow(doc, y, [
    { label: 'Burn Rate', value: formatCurrency(data.burnRate) + '/mes' },
    { label: 'Avg Inflow', value: formatCurrency(data.avgMonthlyInflow) + '/mes' },
    { label: 'Net Burn', value: formatCurrency(data.netBurn) + '/mes', subtitleColor: data.netBurn > 0 ? C.danger : C.success },
  ], 3);

  y += 4;

  // Cash Flow table
  y = drawSectionTitle(doc, 'Cash Flow Mensual (Últimos 6 Meses)', y);
  const totalInflow = data.cashflowMonthly.reduce((s, m) => s + m.inflow, 0);
  const totalOutflow = data.cashflowMonthly.reduce((s, m) => s + m.outflow, 0);

  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Mes', 'Cobros', 'Gastos', 'Neto']],
    body: data.cashflowMonthly.map(m => [
      formatShortMonth(m.month),
      formatCurrency(m.inflow),
      formatCurrency(m.outflow),
      formatCurrency(m.net),
    ]),
    foot: [['Total', formatCurrency(totalInflow), formatCurrency(totalOutflow), formatCurrency(totalInflow - totalOutflow)]],
    columnStyles: {
      1: { halign: 'right' as const },
      2: { halign: 'right' as const },
      3: { halign: 'right' as const },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const rawRow = hookData.row.raw as string[];
        const netStr = rawRow[3];
        if (netStr && netStr.includes('-')) {
          hookData.cell.styles.textColor = C.danger;
        } else {
          hookData.cell.styles.textColor = C.success;
        }
      }
    },
  });
  y = getTableEndY(doc) + 8;

  // Expense breakdown
  y = drawSectionTitle(doc, 'Distribución de Gastos por Categoría (6 Meses)', y);
  autoTable(doc, {
    ...tableDefaults(y),
    head: [['Categoría', 'Total', '% del Total']],
    body: data.expensesByCategory.map(e => [
      e.category,
      formatCurrency(e.total),
      formatPercent(e.percentage),
    ]),
    columnStyles: {
      1: { halign: 'right' as const },
      2: { halign: 'right' as const },
    },
  });
  y = getTableEndY(doc) + 8;

  // Runway
  y = drawSectionTitle(doc, 'Análisis de Runway', y);
  const runwayText = isFinite(data.runway) ? `${Math.round(data.runway)} meses` : 'Indefinido';
  const runwayEndText = data.runwayEndDate === 'Indefinido' ? 'N/A — Generando caja' : new Date(data.runwayEndDate).toLocaleDateString('es-ES');

  y = drawKPIRow(doc, y, [
    { label: 'Caja Actual', value: formatCurrency(data.cashBalance) },
    { label: 'Net Burn Mensual', value: formatCurrency(data.netBurn) },
    { label: 'Runway', value: runwayText },
    { label: 'Fecha Estimada Fin', value: runwayEndText },
  ]);
}

// ===========================
// PAGE 4: Contracts & Customers
// ===========================

function renderPage4(doc: jsPDF, data: ExecutiveReportData) {
  drawHeader(doc, 'Contratos y Clientes', data);
  let y = M.top + 20;

  // Contract KPIs
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

  y += 4;

  // Concentration
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
  y = getTableEndY(doc) + 8;

  // Upcoming Renewals
  y = drawSectionTitle(doc, 'Renovaciones Próximas (90 Días)', y);
  if (data.upcomingRenewals.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.success);
    doc.text('Sin renovaciones próximas', M.left, y + 3);
    y += 10;
  } else {
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
    y = getTableEndY(doc) + 8;
  }

  // Summary metrics
  y = drawSectionTitle(doc, 'Resumen de Cartera', y);
  y = drawKPIRow(doc, y, [
    { label: 'Contratos Activos', value: String(data.activeContracts) },
    { label: 'Clientes Activos', value: String(data.activeClients) },
    { label: '% Revenue Recurrente', value: formatPercent(data.recurringPercentage) },
    { label: 'ARR en Riesgo', value: formatCurrency(data.arrEnRiesgo), subtitleColor: data.arrEnRiesgo > 0 ? C.warning : C.success },
  ]);
}

// ===========================
// Page numbers footer
// ===========================

function addPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(`Página ${i} de ${pageCount}`, PW / 2, 297 - 8, { align: 'center' });
    doc.text('Confidencial', PW - M.right, 297 - 8, { align: 'right' });
  }
}

// ===========================
// Public API
// ===========================

export function renderExecutiveReport(data: ExecutiveReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  renderPage1(doc, data);
  doc.addPage();
  renderPage2(doc, data);
  doc.addPage();
  renderPage3(doc, data);
  doc.addPage();
  renderPage4(doc, data);

  addPageNumbers(doc);

  return doc;
}
