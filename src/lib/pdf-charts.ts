/**
 * Shared chart drawing primitives for PDF reports.
 *
 * Extracted from pdf-renderer.ts to allow reuse across
 * all report renderers without duplication.
 */

import jsPDF from 'jspdf';
import { C, shortCurrency, type RGB } from './pdf-renderer';

// ===========================
// Chart frame & legend
// ===========================

export function drawChartFrame(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  maxVal: number, gridSteps: number = 4, labelPrefix: string = ''
) {
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  const plotTop = y + 4;
  const plotBottom = y + h - 8;
  const plotH = plotBottom - plotTop;
  const labelX = x + 2;

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i <= gridSteps; i++) {
    const gy = plotBottom - (plotH * i) / gridSteps;
    const val = (maxVal * i) / gridSteps;

    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.1);
    doc.line(x + 18, gy, x + w - 4, gy);

    doc.setTextColor(...C.textDimmed);
    doc.text(`${labelPrefix}${shortCurrency(val)}`, labelX, gy + 1.5);
  }

  return { plotTop, plotBottom, plotH, plotLeft: x + 18, plotRight: x + w - 4 };
}

export function drawLegend(doc: jsPDF, x: number, y: number, items: { label: string; color: RGB }[]): number {
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

// ===========================
// Stacked bar chart
// ===========================

export function drawStackedBarChart(
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

    const totalY = frame.plotBottom - (maxVal > 0 ? (d.total / maxVal) * frame.plotH : 0) - 2;
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(shortCurrency(d.total), bx + barW / 2, totalY, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(d.label, bx + barW / 2, frame.plotBottom + 4, { align: 'center' });
  });

  const legendItems = legendLabels.map((label, i) => ({ label, color: colors[i] }));
  return drawLegend(doc, x + 18, y + h + 2, legendItems);
}

// ===========================
// Grouped bar chart
// ===========================

export function drawGroupedBarChart(
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

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textDimmed);
    doc.text(d.label, gx + groupW / 2, frame.plotBottom + 4, { align: 'center' });
  });

  const legendItems = legendLabels.map((label, i) => ({ label, color: colors[i] }));
  return drawLegend(doc, x + 18, y + h + 2, legendItems);
}

// ===========================
// Bar + Line combo chart
// ===========================

export function drawBarLineCombo(
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

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textPrimary);
      doc.text(shortCurrency(d.bar), bx + barW / 2, frame.plotBottom - barH - 2, { align: 'center' });
    }

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

// ===========================
// Horizontal bar chart
// ===========================

export function drawHorizontalBarChart(
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

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  data.forEach((d, i) => {
    const rowY = y + padding + i * rowH + rowH / 2;
    const barRatio = maxVal > 0 ? d.value / maxVal : 0;
    const bW = barRatio * barAreaW;
    const color = d.color || defaultColor;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textPrimary);
    doc.text(d.label, x + labelW, rowY + 1.5, { align: 'right' });

    if (bW > 0.5) {
      doc.setFillColor(...color);
      doc.roundedRect(barAreaX, rowY - barH / 2, bW, barH, 1, 1, 'F');
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.textPrimary);
    doc.text(d.displayValue, barAreaX + barAreaW + 3, rowY + 1.5);
  });

  return y + h + 4;
}
