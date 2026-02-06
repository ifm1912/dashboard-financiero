/**
 * Lógica de cálculo del Forecast operativo
 *
 * Reglas:
 * - Solo clientes con contrato activo
 * - MRR basado en última factura Licencia (o MRR contractual si no hay factura)
 * - AIV factura trimestral → MRR = amount_net / 3
 * - FDP sin facturas aún → usar MRR contractual
 * - Normalización: INDXA → IND
 * - Excluidos: SaaS, CKB (no tienen facturación recurrente activa)
 */

import { Invoice, Contract, ForecastData, ForecastClient, BillingFrequency } from '@/types';

// Mapeo de normalización de clientes (facturas → contratos)
const CLIENT_NORMALIZATION: Record<string, string> = {
  'INDXA': 'IND',
  'MY ': 'MY',  // Hay espacios en algunos registros
};

// Clientes excluidos del forecast
const EXCLUDED_CLIENTS = ['SaaS', 'CKB'];

/**
 * Normaliza el nombre del cliente
 */
function normalizeClientName(name: string): string {
  const trimmed = name.trim();
  return CLIENT_NORMALIZATION[trimmed] || CLIENT_NORMALIZATION[name] || trimmed;
}

/**
 * Determina la frecuencia de facturación del contrato
 */
function getBillingFrequency(contract: Contract): BillingFrequency {
  const freq = contract.billing_frequency?.toLowerCase();
  if (freq === 'trimestral') return 'trimestral';
  if (freq === 'anual') return 'anual';
  return 'mensual';
}

/**
 * Calcula el MRR normalizado según frecuencia
 */
function calculateMRR(amount: number, frequency: BillingFrequency): number {
  switch (frequency) {
    case 'trimestral':
      return amount / 3;
    case 'anual':
      return amount / 12;
    default:
      return amount;
  }
}

/**
 * Calcula el forecast completo
 */
export function calculateForecast(
  contracts: Contract[],
  invoices: Invoice[],
  referenceDate: Date = new Date()
): ForecastData {
  const fiscalYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-indexed (Ene=0, Dic=11)

  // Meses restantes en el FY (incluyendo el mes actual)
  const mesesRestantesFY = 12 - currentMonth;

  // 1. Filtrar contratos activos (excluir los de la lista)
  const activeContracts = contracts.filter(
    (c) => c.status === 'activo' && !EXCLUDED_CLIENTS.includes(c.client_id)
  );

  // 2. Crear mapa de contratos por client_id
  const contractMap = new Map<string, Contract>();
  activeContracts.forEach((c) => {
    contractMap.set(c.client_id, c);
  });

  // 3. Filtrar facturas de tipo Licencia y agrupar por cliente normalizado
  const licenciaInvoices = invoices.filter((inv) => inv.revenue_type === 'Licencia');

  const invoicesByClient = new Map<string, Invoice[]>();
  licenciaInvoices.forEach((inv) => {
    const normalizedName = normalizeClientName(inv.customer_name);
    const existing = invoicesByClient.get(normalizedName) || [];
    existing.push(inv);
    invoicesByClient.set(normalizedName, existing);
  });

  // 4. Calcular facturado YTD (facturas Licencia del año fiscal actual)
  const facturadoYTD = licenciaInvoices
    .filter((inv) => inv.invoice_year === fiscalYear)
    .reduce((sum, inv) => sum + inv.amount_net, 0);

  // 5. Construir lista de clientes para el forecast
  const forecastClients: ForecastClient[] = [];

  activeContracts.forEach((contract) => {
    const clientId = contract.client_id;
    const clientName = contract.client_name;
    const billingFrequency = getBillingFrequency(contract);

    // Buscar facturas del cliente (por client_id)
    const clientInvoices = invoicesByClient.get(clientId) || [];

    // Ordenar por fecha descendente para obtener la última
    const sortedInvoices = [...clientInvoices].sort(
      (a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
    );

    const lastInvoice = sortedInvoices[0];

    let mrrEstimado: number;
    let lastInvoiceDate: string | null;
    let lastInvoiceAmount: number;
    let source: 'factura' | 'contrato';

    if (lastInvoice) {
      // Tiene factura → usar amount_net normalizado
      lastInvoiceDate = lastInvoice.invoice_date;
      lastInvoiceAmount = lastInvoice.amount_net;
      mrrEstimado = calculateMRR(lastInvoice.amount_net, billingFrequency);
      source = 'factura';
    } else {
      // Sin factura → usar MRR contractual
      lastInvoiceDate = null;
      lastInvoiceAmount = contract.current_mrr;
      mrrEstimado = contract.current_mrr;
      source = 'contrato';
    }

    // Forecast para el resto del FY
    const forecastFY = mrrEstimado * mesesRestantesFY;

    forecastClients.push({
      clientId,
      clientName,
      contractName: contract.product,
      billingFrequency,
      lastInvoiceDate,
      lastInvoiceAmount,
      mrrEstimado,
      percentOfTotal: 0, // Se calcula después
      forecastFY,
      source,
    });
  });

  // 6. Calcular totales
  const totalMRR = forecastClients.reduce((sum, c) => sum + c.mrrEstimado, 0);

  // 7. Calcular porcentaje de cada cliente
  forecastClients.forEach((client) => {
    client.percentOfTotal = totalMRR > 0 ? (client.mrrEstimado / totalMRR) * 100 : 0;
  });

  // 8. Ordenar por MRR descendente
  forecastClients.sort((a, b) => b.mrrEstimado - a.mrrEstimado);

  // 9. Calcular horizontes
  const forecastM1 = totalMRR;
  const forecastM3 = totalMRR * 3;
  const forecastM6 = totalMRR * 6;
  const forecastM12 = totalMRR * 12;

  // 10. Vista FY
  const forecastRestanteFY = totalMRR * mesesRestantesFY;
  const totalEstimadoFY = facturadoYTD + forecastRestanteFY;

  return {
    calculatedAt: referenceDate.toISOString(),
    fiscalYear,
    totalMRR,
    forecastM1,
    forecastM3,
    forecastM6,
    forecastM12,
    mesesRestantesFY,
    facturadoYTD,
    forecastRestanteFY,
    totalEstimadoFY,
    clients: forecastClients,
  };
}
