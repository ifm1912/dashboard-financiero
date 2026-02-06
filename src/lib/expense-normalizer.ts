/**
 * Normalización de subcategorías de gastos para homogenizar nomenclatura
 */

// Mapeo de normalización para subcategorías de "Profesionales"
const SUBCATEGORY_NORMALIZATION: Record<string, string> = {
  // Asesoría Fiscal (normalizar variantes)
  'asesor fiscal': 'Asesoría Fiscal',
  'asesoría fiscal': 'Asesoría Fiscal',

  // Asesoría Contable (normalizar variantes)
  'asesor contable': 'Asesoría Contable',
  'asesoría contable': 'Asesoría Contable',

  // Asesoría General (mantener genérica separada)
  'asesoría': 'Asesoría General',
};

/**
 * Normaliza una subcategoría de gastos a su forma canónica
 * @param subcategory - Subcategoría original del CSV
 * @returns Subcategoría normalizada
 */
export function normalizeExpenseSubcategory(subcategory: string): string {
  if (!subcategory) return '';
  const key = subcategory.toLowerCase().trim();
  return SUBCATEGORY_NORMALIZATION[key] || subcategory;
}
