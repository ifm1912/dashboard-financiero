import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExecutiveReportData, formatCurrency, formatPercent, formatShortMonth } from './report-data';

type RGB = [number, number, number];

// Design system colors (RGB tuples)
const C = {
  accent:      [79, 70, 229]   as RGB,
  accentLight: [99, 102, 241]  as RGB,
  textPrimary: [15, 23, 42]    as RGB,
  textMuted:   [100, 116, 139] as RGB,
  textDimmed:  [148, 163, 184] as RGB,
  success:     [22, 163, 74]   as RGB,
  danger:      [220, 38, 38]   as RGB,
  warning:     [202, 138, 4]   as RGB,
  bgMuted:     [241, 245, 249] as RGB,
  bgBase:      [248, 250, 252] as RGB,
  border:      [226, 232, 240] as RGB,
  white:       [255, 255, 255] as RGB,
};

// Category colors for expense chart
const CATEGORY_COLORS: RGB[] = [
  C.accent, C.success, C.warning, C.danger,
  [124, 58, 237],  // violet
  [8, 145, 178],   // cyan
  [219, 39, 119],  // pink
];

const M = { left: 15, right: 15, top: 20, bottom: 15 };
const PW = 210; // A4 width mm
const CW = PW - M.left - M.right; // content width

// ===========================
// Shared helpers
// ===========================

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
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.accent);
  doc.text('Informe Ejecutivo Mensual', M.left, M.top);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text(`Generado: ${data.reportDate}`, PW - M.right, M.top, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(...C.textPrimary);
  const capitalizedMonth = data.reportMonth.charAt(0).toUpperCase() + data.reportMonth.slice(1);
  doc.text(capitalizedMonth, M.left, M.top + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textDimmed);
  doc.text(title.toUpperCase(), M.left, M.top + 13);

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

function drawKPI(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, subtitle?: string, subtitleColor?: RGB
) {
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textDimmed);
  doc.text(label.toUpperCase(), x + 4, y + 6);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.textPrimary);
  doc.text(value, x + 4, y + 14);

  if (subtitle) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...(subtitleColor || C.textMuted));
    doc.text(subtitle, x + 4, y + 19);
  }
}

function drawKPIRow(
  doc: jsPDF, y: number,
  kpis: { label: string; value: string; subtitle?: string; subtitleColor?: RGB }[],
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
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 0;
}

// Format large numbers compactly for axis labels (e.g. 150K, 1.2M)
function shortCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

// ===========================
// CHART DRAWING PRIMITIVES
// ===========================

// Shared chart frame: background, border, grid lines, Y-axis labels
function drawChartFrame(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  maxVal: number, gridSteps: number = 4, labelPrefix: string = ''
) {
  // Background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  // Grid lines and Y-axis labels
  const plotTop = y + 4;
  const plotBottom = y + h - 8;
  const plotH = plotBottom - plotTop;
  const labelX = x + 2;

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i <= gridSteps; i++) {
    const gy = plotBottom - (plotH * i) / gridSteps;
    const val = (maxVal * i) / gridSteps;

    // Grid line
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.1);
    doc.line(x + 18, gy, x + w - 4, gy);

    // Label
    doc.setTextColor(...C.textDimmed);
    doc.text(`${labelPrefix}${shortCurrency(val)}`, labelX, gy + 1.5);
  }

  return { plotTop, plotBottom, plotH, plotLeft: x + 18, plotRight: x + w - 4 };
}

// Draw a legend row below a chart
function drawLegend(doc: jsPDF, x: number, y: number, items: { label: string; color: RGB }[]): number {
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  let cx = x;
  items.forEach(item => {
    doc.setFillColor(...item.color);
    doc.rect(cx, y - 2, 3, 3, 'F');
    doc.setTextColor(...C.textMuted);
    doc.text(item.label, cx + 4.5, y + 0.5);
    cx += doc.getTextWidth(item.label) + 10;
  });
  return y + 6;
}

// STACKED BAR CHART (for monthly revenue: recurring + non-recurring)
function drawStackedBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; values: number[]; total: number }[],
  colors: RGB[],
  legendLabels: string[]
): number {
  const maxVal = Math.max(...data.map(d => d.total)) * 1.15;
  const frame = drawChartFrame(doc, x, y, w, h, maxVal);

  const count = data.length;
  const plotW = frame.plotRight - frame.plotLeft;
  const gap = plotW * 0.15 / (count + 1);
  const barW = (plotW - gap * (count + 1)) / count;

  data.forEach((d, i) => {
    const bx = frame.plotLeft + gap + i * (barW + gap);
    let currentBottom = frame.plotBottom;

    d.values.forEach((val, vi) => {
      const barH = maxVal > 0 ? (val / maxVal) * frame.plotH : 0;
      if (barH > 0.5) {
        doc.setFillColor(...colors[vi]);
        doc.rect(bx, currentBottom - barH, barW, barH, 'F');
        currentBottom -= barH;
      }
    });

    // Total label on top
    const totalY = frame.plotBottom - (maxVal > 0 ? (d.total / maxVal) * frame.plotH : 0) - 2;
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(shortCurrency(d.total), bx + barW / 2, totalY, { align: 'center' });

    // X-axis label
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(d.label, bx + barW / 2, frame.plotBottom + 4, { align: 'center' });
  });

  // Legend
  const legendItems = legendLabels.map((label, i) => ({ label, color: colors[i] }));
  return drawLegend(doc, x + 18, y + h + 2, legendItems);
}

// GROUPED BAR CHART (for cashflow: inflow vs outflow side by side)
function drawGroupedBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; values: number[] }[],
  colors: RGB[],
  legendLabels: string[]
): number {
  const allVals = data.flatMap(d => d.values);
  const maxVal = Math.max(...allVals) * 1.15;
  const frame = drawChartFrame(doc, x, y, w, h, maxVal);

  const count = data.length;
  const groupCount = colors.length;
  const plotW = frame.plotRight - frame.plotLeft;
  const groupGap = plotW * 0.12 / (count + 1);
  const groupW = (plotW - groupGap * (count + 1)) / count;
  const innerGap = 1;
  const barW = (groupW - innerGap * (groupCount - 1)) / groupCount;

  data.forEach((d, i) => {
    const gx = frame.plotLeft + groupGap + i * (groupW + groupGap);

    d.values.forEach((val, vi) => {
      const barH = maxVal > 0 ? (val / maxVal) * frame.plotH : 0;
      const bx = gx + vi * (barW + innerGap);
      if (barH > 0.3) {
        doc.setFillColor(...colors[vi]);
        doc.rect(bx, frame.plotBottom - barH, barW, barH, 'F');
      }
    });

    // X-axis label
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(d.label, gx + groupW / 2, frame.plotBottom + 4, { align: 'center' });
  });

  const legendItems = legendLabels.map((label, i) => ({ label, color: colors[i] }));
  return drawLegend(doc, x + 18, y + h + 2, legendItems);
}

// BAR + LINE COMBO (for MRR bars + ARR line)
function drawBarLineCombo(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; bar: number; line: number }[],
  barColor: RGB, lineColor: RGB,
  barLabel: string, lineLabel: string
): number {
  const maxBar = Math.max(...data.map(d => d.bar)) * 1.2;
  const maxLine = Math.max(...data.map(d => d.line)) * 1.1;
  const frame = drawChartFrame(doc, x, y, w, h, maxBar);

  const count = data.length;
  const plotW = frame.plotRight - frame.plotLeft;
  const gap = plotW * 0.15 / (count + 1);
  const barW = (plotW - gap * (count + 1)) / count;

  // Draw bars
  data.forEach((d, i) => {
    const bx = frame.plotLeft + gap + i * (barW + gap);
    const barH = maxBar > 0 ? (d.bar / maxBar) * frame.plotH : 0;
    if (barH > 0.3) {
      doc.setFillColor(...barColor);
      doc.rect(bx, frame.plotBottom - barH, barW, barH, 'F');

      // Value label on bar
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textPrimary);
      doc.text(shortCurrency(d.bar), bx + barW / 2, frame.plotBottom - barH - 2, { align: 'center' });
    }

    // X label
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(d.label, bx + barW / 2, frame.plotBottom + 4, { align: 'center' });
  });

  // Draw line for ARR
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.6);
  const points = data.map((d, i) => {
    const bx = frame.plotLeft + gap + i * (barW + gap) + barW / 2;
    const ly = maxLine > 0 ? frame.plotBottom - (d.line / maxLine) * frame.plotH : frame.plotBottom;
    return { x: bx, y: ly };
  });

  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }

  // Dots on line
  points.forEach(p => {
    doc.setFillColor(...lineColor);
    doc.circle(p.x, p.y, 0.8, 'F');
  });

  // ARR labels on line
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...lineColor);
  data.forEach((d, i) => {
    doc.text(shortCurrency(d.line), points[i].x, points[i].y - 2, { align: 'center' });
  });

  // Right axis label for ARR
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lineColor);
  doc.text('ARR', x + w - 2, frame.plotTop - 1, { align: 'right' });

  return drawLegend(doc, x + 18, y + h + 2, [
    { label: barLabel, color: barColor },
    { label: lineLabel, color: lineColor },
  ]);
}

// HORIZONTAL BAR CHART (for forecast horizons or expense categories)
function drawHorizontalBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number; displayValue: string; color?: RGB }[],
  defaultColor: RGB
): number {
  const maxVal = Math.max(...data.map(d => d.value));
  const count = data.length;
  const padding = 4;
  const labelW = 28;
  const valueW = 22;
  const barAreaW = w - labelW - valueW - padding * 2;
  const barAreaX = x + labelW + padding;
  const rowH = (h - padding * 2) / count;
  const barH = Math.min(rowH * 0.65, 6);

  // Background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  data.forEach((d, i) => {
    const rowY = y + padding + i * rowH + rowH / 2;
    const barRatio = maxVal > 0 ? d.value / maxVal : 0;
    const barW = barRatio * barAreaW;
    const color = d.color || defaultColor;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textPrimary);
    doc.text(d.label, x + labelW, rowY + 1.5, { align: 'right' });

    // Bar
    if (barW > 0.5) {
      doc.setFillColor(...color);
      doc.roundedRect(barAreaX, rowY - barH / 2, barW, barH, 1, 1, 'F');
    }

    // Value
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(d.displayValue, barAreaX + barAreaW + 3, rowY + 1.5);
  });

  return y + h + 4;
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
  const runwayColor: RGB = data.runway < 6 ? C.danger : data.runway < 12 ? C.warning : C.success;

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

  // --- CHART: Stacked Bar — Monthly Revenue ---
  y = drawSectionTitle(doc, 'Ingresos Mensuales (Últimos 6 Meses)', y);
  y = drawStackedBarChart(
    doc, M.left, y, CW, 52,
    data.monthlyRevenue.map(m => ({
      label: formatShortMonth(m.month),
      values: [m.recurring, m.nonRecurring],
      total: m.total,
    })),
    [C.accent, C.success],
    ['Recurrente', 'No Recurrente']
  );

  y += 4;

  // --- CHART: Bar + Line Combo — MRR / ARR ---
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

  y += 4;

  // Efficiency KPIs
  y = drawSectionTitle(doc, 'Eficiencia Operativa', y);
  y = drawKPIRow(doc, y, [
    { label: 'DSO', value: `${Math.round(data.dso)} días` },
    { label: 'Collection Rate', value: formatPercent(data.collectionRate) },
    { label: 'Pendiente Cobro', value: formatCurrency(data.pendingAmount), subtitle: `${formatPercent(data.pendingPercentage)} del YTD` },
  ], 3);

  y += 4;

  // --- CHART: Horizontal Bar — Forecast ---
  y = drawSectionTitle(doc, 'Forecast de Ingresos', y);
  const forecastAlphas: RGB[] = [
    C.accent,
    C.accentLight,
    [129, 140, 248],  // lighter indigo
    [165, 180, 252],  // lightest indigo
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

  // FY summary KPIs
  y = drawSectionTitle(doc, `Vista FY ${data.fiscalYear}`, y);
  y = drawKPIRow(doc, y, [
    { label: 'Facturado YTD', value: formatCurrency(data.facturadoYTD) },
    { label: 'Forecast Restante', value: formatCurrency(data.forecastRestanteFY) },
    { label: 'Total Estimado FY', value: formatCurrency(data.totalEstimadoFY) },
  ], 3);
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

  // --- CHART: Grouped Bar — Cash Flow Monthly ---
  y = drawSectionTitle(doc, 'Cash Flow Mensual (Últimos 6 Meses)', y);
  y = drawGroupedBarChart(
    doc, M.left, y, CW, 55,
    data.cashflowMonthly.map(m => ({
      label: formatShortMonth(m.month),
      values: [m.inflow, m.outflow],
    })),
    [C.success, C.danger],
    ['Cobros', 'Gastos']
  );

  y += 4;

  // --- CHART: Horizontal Bar — Expenses by Category ---
  y = drawSectionTitle(doc, 'Distribución de Gastos por Categoría (6 Meses)', y);
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

  // Runway KPIs
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
