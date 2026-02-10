import jsPDF from 'jspdf';
import { VCReportData, formatCurrency } from './vc-report-data';
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
  type RGB,
} from './pdf-renderer';

// ===========================
// PAGE 1: Revenue · Clients · Pipeline · Cash
// ===========================

function renderPage1(doc: jsPDF, data: VCReportData) {
  // --- Header ---
  drawHeader(doc, data.periodLabel, {
    reportTitle: 'GPTadvisor — VC Report',
    reportDate: data.reportDate,
    subtitle: data.periodLabel,
  });

  let y = M.top + 20;

  // --- Custom text (if provided) ---
  if (data.customText.trim()) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textPrimary);

    const lines = doc.splitTextToSize(data.customText.trim(), CW);
    doc.text(lines, M.left, y);
    y += lines.length * 3.8 + 6;
  }

  // --- Section 1: Revenue ---
  y = drawSectionTitle(doc, 'Revenue', y);

  const revenueKPIs: { label: string; value: string; subtitle?: string }[] = [
    {
      label: `Revenue FY${String(data.periodYear).slice(-2)}`,
      value: formatCurrency(data.revenueYTD ?? data.totalRevenuePeriod),
      subtitle: `FY ${data.periodYear}`,
    },
    {
      label: 'Revenue Quarter',
      value: data.revenueQuarter !== null ? formatCurrency(data.revenueQuarter) : '—',
      subtitle: data.periodType === 'quarter' ? data.periodLabel : `Current Q`,
    },
    {
      label: 'Current MRR',
      value: formatCurrency(data.mrrCurrent),
    },
    {
      label: 'Current ARR',
      value: formatCurrency(data.arrCurrent),
    },
  ];

  y = drawKPIRow(doc, y, revenueKPIs, 4);

  y += 4;

  // --- Section 2: Clients & Usage ---
  y = drawSectionTitle(doc, 'Clients & Usage', y);

  y = drawKPIRow(
    doc,
    y,
    [
      {
        label: 'Total Clients',
        value: String(data.totalClients),
        subtitle: 'Financial institutions',
      },
      {
        label: 'Monthly Active Users',
        value: data.monthlyActiveUsers,
      },
      {
        label: 'Daily Chats',
        value: data.dailyChats,
      },
    ],
    3
  );

  y += 4;

  // --- Section 3: Pipeline ARR ---
  y = drawSectionTitle(doc, 'Pipeline ARR', y);

  // Pipeline KPI cards
  y = drawKPIRow(
    doc,
    y,
    [
      {
        label: 'Pipeline ARR',
        value: formatCurrency(data.pipelineTotalARR),
      },
      {
        label: 'Deals Near Closing',
        value: String(data.pipelineDealCount),
        subtitle: 'In negotiation',
      },
    ],
    2
  );

  // Pipeline client names detail
  if (data.pipelineClientNames.length > 0) {
    y += 1;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.textMuted);

    const clientList = data.pipelineClientNames.join(', ');
    const pipelineLines = doc.splitTextToSize(
      `Clients near closing: ${clientList}`,
      CW
    );
    doc.text(pipelineLines, M.left, y);
    y += pipelineLines.length * 3.5 + 5;
  }

  y += 2;

  // --- Section 4: Cash ---
  y = drawSectionTitle(doc, 'Cash', y);

  const runwayText = isFinite(data.runway)
    ? `${Math.round(data.runway)} months`
    : 'Indefinite';
  const runwayColor: RGB =
    data.runway < 6 ? C.danger : data.runway < 12 ? C.warning : C.success;

  y = drawKPIRow(doc, y, [
    {
      label: 'Cash in Balance',
      value: formatCurrency(data.cashBalance),
      subtitle: `As of ${data.cashBalanceDate}`,
    },
    {
      label: 'Burn Rate',
      value: `${formatCurrency(data.burnRate)}/mo`,
      subtitle: 'Avg last 6 months',
    },
    {
      label: 'Net Burn',
      value: `${formatCurrency(data.netBurn)}/mo`,
      subtitleColor: data.netBurn > 0 ? C.danger : C.success,
      subtitle: data.netBurn > 0 ? 'Burning cash' : 'Cash positive',
    },
    {
      label: 'Runway',
      value: runwayText,
      subtitleColor: runwayColor,
    },
  ]);
}

// ===========================
// PAGE 2: Financiación
// ===========================

function renderPage2(doc: jsPDF, data: VCReportData) {
  drawHeader(doc, 'Financiación', {
    reportTitle: 'GPTadvisor — VC Report',
    reportDate: data.reportDate,
    subtitle: data.periodLabel,
  });

  let y = M.top + 20;

  y = drawSectionTitle(doc, 'Financiación Obtenida', y);

  // Render each financing item as a prominent card
  const gap = 4;
  const cardW = (CW - gap) / 2;
  const cardH = 38;

  data.financiacion.forEach((item, i) => {
    const x = M.left + i * (cardW + gap);

    // Card background
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    // Accent bar at top of card
    doc.setFillColor(...C.accent);
    doc.roundedRect(x, y, cardW, 3, 2, 2, 'F');
    // Fill the bottom corners of the accent bar so it looks like a top strip
    doc.rect(x, y + 1.5, cardW, 1.5, 'F');

    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.accent);
    doc.text(item.label, x + 5, y + 10);

    // Amount
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(formatCurrency(item.amount), x + 5, y + 21);

    // Detail
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textMuted);
    doc.text(item.detail, x + 5, y + 28);
  });

  y += cardH + 8;

  // Total financing summary
  const totalFinancing = data.financiacion.reduce((sum, f) => sum + f.amount, 0);

  y = drawSectionTitle(doc, 'Resumen', y);

  y = drawKPIRow(
    doc,
    y,
    [
      {
        label: 'Total Financiación',
        value: formatCurrency(totalFinancing),
        subtitle: 'Subvenciones + Préstamos',
      },
      {
        label: 'Subvención Neotec',
        value: formatCurrency(data.financiacion[0]?.amount ?? 0),
        subtitle: 'CDTI — No reembolsable',
        subtitleColor: C.success,
      },
      {
        label: 'Préstamo ENISA',
        value: formatCurrency(data.financiacion[1]?.amount ?? 0),
        subtitle: 'Dic 2025 — Préstamo participativo',
      },
    ],
    3
  );
}

// ===========================
// Public API
// ===========================

export function renderVCReport(data: VCReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  renderPage1(doc, data);
  doc.addPage();
  renderPage2(doc, data);

  // --- Footer ---
  addPageNumbers(doc);

  return doc;
}
