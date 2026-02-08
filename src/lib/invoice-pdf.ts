/**
 * Generador de factura PDF para clientes
 *
 * Replica el diseño de la plantilla GPTadvisor:
 * - Logo text-based arriba-izquierda
 * - Datos empresa + meta factura
 * - Bloque "Facturar a" con datos del cliente
 * - Tabla de líneas (Descripción | Importe)
 * - Instrucciones de pago + Subtotal/IVA/Total
 * - "Gracias." + footer oscuro
 */

import { jsPDF } from 'jspdf';
import { Invoice, BillingClient } from '@/types';
import { getBillingClients } from './data';

// ── Constantes de diseño ─────────────────────────────────────────

// A4 dimensions in mm
const PW = 210;
const PH = 297;
const ML = 25; // margen izquierdo
const MR = 25; // margen derecho
const CW = PW - ML - MR; // ancho útil (160mm)

// Colores (RGB tuples)
type RGB = [number, number, number];
const C = {
  black: [17, 24, 39] as RGB,        // #111827
  text: [55, 65, 81] as RGB,         // #374151
  textLight: [107, 114, 128] as RGB, // #6b7280
  accent: [79, 70, 229] as RGB,      // #4f46e5 (indigo)
  accentLight: [238, 242, 255] as RGB, // #eef2ff (indigo-50)
  border: [226, 232, 240] as RGB,    // #e2e8f0
  headerBg: [241, 245, 249] as RGB,  // #f1f5f9 (slate-100)
  footerBg: [30, 41, 59] as RGB,     // #1e293b (slate-800)
  white: [255, 255, 255] as RGB,
};

// Datos fijos de la empresa
const COMPANY = {
  name: 'GPT ADVISOR, S.L.',
  cif: 'B13863287',
  address: 'Calle Conde Salvatierra 30',
  city: 'Valencia, España',
  postalCode: '46004',
  bank: 'Sabadell',
  iban: 'ES28 0081 0145 0100 0427 3432',
  email: 'ifornies@gptadvisor.com',
  paymentMethod: 'Transferencia bancaria',
};

// ── Helpers ──────────────────────────────────────────────────────

function formatCurrency2d(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function setColor(doc: jsPDF, rgb: RGB) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setFillColor(doc: jsPDF, rgb: RGB) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDrawColor(doc: jsPDF, rgb: RGB) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// ── Logo ─────────────────────────────────────────────────────────

/** Carga la imagen del logo como base64 data URL */
async function loadLogoImage(): Promise<string | null> {
  try {
    const response = await fetch('/logo-gptadvisor.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawLogo(doc: jsPDF, x: number, y: number, logoData: string | null) {
  if (logoData) {
    // Imagen real: 586×252px → ratio 2.33:1
    // Tamaño en PDF: ~70mm ancho × ~30mm alto
    const logoW = 70;
    const logoH = logoW / (586 / 252); // ≈ 30mm
    doc.addImage(logoData, 'PNG', x, y, logoW, logoH);
  } else {
    // Fallback texto si no se puede cargar la imagen
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    setColor(doc, C.black);
    doc.text('GPT', x, y + 12);
    const gptWidth = doc.getTextWidth('GPT');
    doc.setFont('helvetica', 'normal');
    doc.text('advisor', x + gptWidth, y + 12);
  }
}

// ── Secciones del PDF ────────────────────────────────────────────

function drawCompanyInfo(doc: jsPDF, y: number): number {
  // Caja izquierda: datos de la empresa
  const boxW = 75;
  const boxH = 32;
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, boxW, boxH);

  let ty = y + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.black);
  doc.text(COMPANY.name, ML + 4, ty);

  doc.setFont('helvetica', 'italic');
  setColor(doc, C.text);
  doc.setFontSize(8.5);
  ty += 5;
  doc.text(COMPANY.address, ML + 4, ty);
  ty += 4.5;
  doc.text(COMPANY.city, ML + 4, ty);
  ty += 4.5;
  doc.text(COMPANY.postalCode, ML + 4, ty);
  ty += 4.5;
  doc.setFont('helvetica', 'italic');
  doc.text(`CIF: ${COMPANY.cif}`, ML + 4, ty);

  return y + boxH;
}

function drawInvoiceMeta(doc: jsPDF, y: number, invoice: Invoice): number {
  // Caja derecha: fecha, nº factura, cliente
  const boxX = ML + 90;
  const boxW = CW - 90;
  const boxH = 32;

  // Labels
  const labels = ['Fecha de factura:', 'Número de factura:', 'Cliente:'];
  const values = [
    formatDateES(invoice.invoice_date),
    invoice.invoice_id,
    invoice.customer_name,
  ];

  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);

  let ty = y + 6;
  for (let i = 0; i < labels.length; i++) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    setColor(doc, C.black);
    doc.text(labels[i], boxX, ty);

    // Valor en recuadro azul claro
    const valX = boxX + 47;
    const valW = boxW - 47;
    setFillColor(doc, C.accentLight);
    doc.roundedRect(valX, ty - 3.5, valW, 5.5, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(doc, C.text);
    doc.text(values[i], valX + 2, ty);

    ty += 8;
  }

  return y + boxH;
}

function drawBillingTo(doc: jsPDF, y: number, client: BillingClient | null, customerName: string): number {
  const startY = y + 8;

  // Header "Facturar a:" con fondo
  setFillColor(doc, C.headerBg);
  doc.rect(ML, startY, 70, 6, 'F');
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, startY, 70, 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, C.black);
  doc.text('Facturar a:', ML + 3, startY + 4.2);

  let ty = startY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, C.black);

  if (client) {
    const name = client.fiscal_name || customerName;
    doc.text(name, ML + 3, ty);
    ty += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, C.text);

    if (client.nif) {
      doc.text(client.nif, ML + 3, ty);
      ty += 4.5;
    }
    if (client.address) {
      doc.text(client.address, ML + 3, ty);
      ty += 4.5;
    }
    const cityLine = [client.postal_code, client.city, client.country].filter(Boolean).join(', ');
    if (cityLine) {
      doc.text(cityLine, ML + 3, ty);
      ty += 4.5;
    }
  } else {
    // Fallback: solo nombre del customer
    doc.text(customerName, ML + 3, ty);
    ty += 5;
  }

  return ty + 4;
}

function drawLineItemsTable(doc: jsPDF, y: number, invoice: Invoice): number {
  const startY = y + 4;
  const headerH = 7;
  const rowH = 8;
  const descColW = CW - 35; // ancho columna descripción
  const importeColW = 35;   // ancho columna importe

  // Header de tabla
  setFillColor(doc, C.headerBg);
  doc.rect(ML, startY, CW, headerH, 'F');
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, startY, CW, headerH);
  doc.line(ML + descColW, startY, ML + descColW, startY + headerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, C.accent);
  doc.text('Descripción', ML + 3, startY + 4.8);
  doc.text('Importe', ML + descColW + importeColW / 2, startY + 4.8, { align: 'center' });

  // Fila de datos
  const rowY = startY + headerH;
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.2);
  doc.rect(ML, rowY, CW, rowH);
  doc.line(ML + descColW, rowY, ML + descColW, rowY + rowH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, C.text);

  // Concepto (wrap si es muy largo)
  const concept = invoice.invoice_concept || '';
  const maxConceptW = descColW - 6;
  const lines = doc.splitTextToSize(concept, maxConceptW);
  const extraRows = Math.max(0, lines.length - 1);
  const actualRowH = rowH + extraRows * 4;

  // Re-dibujar la fila con altura ajustada si hay más líneas
  if (extraRows > 0) {
    setFillColor(doc, C.white);
    doc.rect(ML, rowY, CW, actualRowH, 'FD');
    doc.line(ML + descColW, rowY, ML + descColW, rowY + actualRowH);
  }

  doc.text(lines, ML + 3, rowY + 5);

  // Importe
  doc.setFont('helvetica', 'normal');
  setColor(doc, C.black);
  doc.text(formatCurrency2d(invoice.amount_net), ML + descColW + importeColW - 3, rowY + 5, { align: 'right' });

  // Fila vacía extra (como la plantilla)
  const emptyRowY = rowY + actualRowH;
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.2);
  doc.rect(ML, emptyRowY, CW, rowH);
  doc.line(ML + descColW, emptyRowY, ML + descColW, emptyRowY + rowH);

  return emptyRowY + rowH;
}

function drawPaymentAndTotals(doc: jsPDF, y: number, invoice: Invoice): number {
  const startY = y + 6;
  const leftColW = CW * 0.5;
  const rightColW = CW * 0.5;
  const rightX = ML + leftColW;

  // ── Lado izquierdo: Instrucciones de pago ──
  // Header
  setFillColor(doc, C.headerBg);
  doc.rect(ML, startY, leftColW - 5, 6, 'F');
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, startY, leftColW - 5, 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, C.black);
  doc.text('Instrucciones de pago:', ML + 3, startY + 4.2);

  // Datos de pago
  let payY = startY + 13;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  setColor(doc, C.text);
  doc.text('Pago por transferencia bancaria', ML + 3, payY);
  payY += 5;
  doc.text(`IBAN: ${COMPANY.iban}`, ML + 3, payY);
  payY += 5;
  doc.text(COMPANY.bank, ML + 3, payY);

  // ── Lado derecho: Subtotal, IVA, Total ──
  const labelX = rightX + 10;
  const valueX = ML + CW - 3;
  let totY = startY;

  // Calcular IVA
  const subtotal = invoice.amount_net;
  const ivaRate = invoice.tax_rate_implied || 0.21;
  const ivaPercent = Math.round(ivaRate * 100);
  const ivaAmount = invoice.amount_total - invoice.amount_net;
  const total = invoice.amount_total;

  // SUBTOTAL
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.2);
  doc.line(labelX, totY + 6, valueX + 3, totY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, C.black);
  doc.text('SUBTOTAL:', labelX + 2, totY + 4);
  doc.setFont('helvetica', 'normal');
  setColor(doc, C.text);
  doc.text(formatCurrency2d(subtotal), valueX, totY + 4, { align: 'right' });

  totY += 9;
  doc.line(labelX, totY + 6, valueX + 3, totY + 6);
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.black);
  doc.text('TIPO DE IVA:', labelX + 2, totY + 4);
  doc.setFont('helvetica', 'normal');
  setColor(doc, C.text);
  doc.text(`${ivaPercent}%`, valueX, totY + 4, { align: 'right' });

  totY += 9;
  doc.line(labelX, totY + 6, valueX + 3, totY + 6);
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.black);
  doc.text('IVA:', labelX + 2, totY + 4);
  doc.setFont('helvetica', 'normal');
  setColor(doc, C.text);
  doc.text(formatCurrency2d(ivaAmount), valueX, totY + 4, { align: 'right' });

  totY += 9;
  doc.line(labelX, totY + 6, valueX + 3, totY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, C.black);
  doc.text('TOTAL', labelX + 2, totY + 4.5);

  // Total grande
  doc.setFontSize(16);
  setColor(doc, C.black);
  doc.text(formatCurrency2d(total), valueX, totY + 5.5, { align: 'right' });

  return Math.max(payY + 5, totY + 14);
}

function drawThanks(doc: jsPDF, y: number): number {
  const ty = y + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, C.black);
  doc.text('Gracias.', PW / 2, ty, { align: 'center' });
  return ty + 8;
}

function drawFooter(doc: jsPDF) {
  const footerH = 28;
  const footerY = PH - footerH;

  // Barra oscura
  setFillColor(doc, C.footerBg);
  doc.rect(0, footerY, PW, footerH, 'F');

  // Texto centrado
  const centerX = PW / 2;
  let ty = footerY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY.name + '.', centerX, ty, { align: 'center' });

  ty += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 225);

  const footerLine = `Banco: ${COMPANY.bank}  |  Método de pago: ${COMPANY.paymentMethod}  |  E-mail: ${COMPANY.email}`;
  doc.text(footerLine, centerX, ty, { align: 'center' });
}

// ── Función principal ────────────────────────────────────────────

export async function generateInvoicePDF(invoice: Invoice): Promise<void> {
  // Cargar datos de facturación del cliente y logo en paralelo
  let billingClients: Record<string, BillingClient> = {};
  let logoData: string | null = null;

  try {
    const [clients, logo] = await Promise.all([
      getBillingClients().catch(() => ({} as Record<string, BillingClient>)),
      loadLogoImage(),
    ]);
    billingClients = clients;
    logoData = logo;
  } catch {
    console.warn('Error cargando recursos para la factura');
  }

  // Buscar cliente (intentar con nombre exacto y trimmed)
  const customerName = invoice.customer_name?.trim() || '';
  const client = billingClients[customerName] || billingClients[invoice.customer_name] || null;

  // Crear documento A4
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Renderizar secciones ──
  let y = 18;

  // 1. Logo (imagen real PNG)
  drawLogo(doc, ML, y, logoData);
  y += 35;

  // 2. Datos empresa (izquierda) + meta factura (derecha)
  const companyEndY = drawCompanyInfo(doc, y);
  drawInvoiceMeta(doc, y, invoice);
  y = companyEndY;

  // 3. Facturar a
  y = drawBillingTo(doc, y, client, customerName);

  // 4. Tabla de líneas
  y = drawLineItemsTable(doc, y, invoice);

  // 5. Instrucciones de pago + totales
  y = drawPaymentAndTotals(doc, y, invoice);

  // 6. Gracias
  drawThanks(doc, y);

  // 7. Footer (posición fija al final de la página)
  drawFooter(doc);

  // ── Guardar ──
  const filename = `factura_${invoice.invoice_id}.pdf`;
  doc.save(filename);
}
