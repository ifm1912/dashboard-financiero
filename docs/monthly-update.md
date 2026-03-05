# Proceso de Actualización Mensual del Dashboard

> Guía paso a paso para cerrar un mes y actualizar todos los datos del dashboard financiero.

## Pipeline de datos

```
                        FUENTES EXTERNAS
                    ┌───────────────────────┐
                    │  Extracto bancario     │  (Excel del banco)
                    │  Facturas emitidas     │  (facturas_historicas.csv)
                    │  Saldo bancario real   │  (consulta en banca online)
                    │  Contratos vigentes    │  (Contratos_GPTadvisor.xlsx)
                    └──────────┬────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                   ▼
   BANCO (cf_banco/)     FACTURAS (raíz)     MANUAL (JSONs)
            │                  │                   │
   categorizar_           generar_campos_      contracts.json
   movimientos.py         derivados_y_         cash_balance.json
   (--input)              data_quality.py      contract_events.json
            │                  │                   │
   output_review.xlsx     facturas_historicas_     │
   (revisión manual)      enriquecido.csv         │
            │                  │                   │
   categorizar_           calcular_mrr_            │
   movimientos.py         aproximado.py            │
   (--apply)                   │                   │
            │             calcular_metricas_       │
            │             recurring_vs_non.py      │
            ▼                  ▼                   ▼
   ┌─────────────────────────────────────────────────┐
   │         dashboard/public/data/                   │
   │                                                  │
   │  expenses.csv          mrr_aproximado_por_mes.csv│
   │  inflows.csv           metricas_recurring_vs_... │
   │  facturas_historicas_enriquecido.csv              │
   │  contracts.json        cash_balance.json          │
   │  contract_events.json  billing_clients.json       │
   └──────────────────────┬───────────────────────────┘
                          │
                          ▼
                    Dashboard Next.js
                    (lee todo de public/data/)
```

---

## Checklist mensual

### Prerequisitos

- [ ] Acceso a banca online (extracto del mes cerrado)
- [ ] Facturas emitidas del mes ya registradas
- [ ] Python con pandas y openpyxl instalados (`pip install -r requirements.txt`)

---

### Paso 1: Movimientos bancarios

**Tiempo estimado: 15-30 min (incluye revisión manual)**

1. **Descargar extracto** del banco en formato Excel (.xls/.xlsx)
2. **Colocar** el fichero en `cf_banco/` con nombre descriptivo:
   ```
   cf_banco/cf_febrero2026.xls
   ```
3. **Categorizar automáticamente**:
   ```bash
   python categorizar_movimientos.py --input "cf_banco/cf_febrero2026.xls"
   ```
   Genera: `cf_banco/output_review.xlsx`

4. **Revisión manual** en Excel:
   - Abrir `cf_banco/output_review.xlsx`
   - Filtrar columna de confianza por "REVISAR"
   - Corregir categoría/subcategoría donde sea necesario
   - Guardar el fichero

5. **Aplicar correcciones y exportar**:
   ```bash
   python categorizar_movimientos.py --apply "cf_banco/output_review.xlsx"
   ```
   Genera:
   - `dashboard/public/data/expenses.csv` (actualizado)
   - `dashboard/public/data/inflows.csv` (actualizado)
   - `cf_banco/corrections_log.json` (audit trail)

6. **Backup** del review:
   ```bash
   cp cf_banco/output_review.xlsx "cf_banco/output_review_feb2026_backup.xlsx"
   ```

---

### Paso 2: Facturas y métricas de ingresos

**Tiempo estimado: 5-10 min**

1. **Verificar** que las facturas de febrero están en `facturas_historicas.csv`
   - Si se crearon desde el dashboard (API /api/invoices POST), ya estarán
   - Si no, añadirlas manualmente al CSV

2. **Regenerar datos derivados**:
   ```bash
   python generar_campos_derivados_y_data_quality.py
   ```
   Genera: `facturas_historicas_enriquecido.csv` + `data_quality_report.txt`

3. **Regenerar métricas**:
   ```bash
   python calcular_mrr_aproximado.py
   python calcular_metricas_recurring_vs_non.py
   ```
   Genera: `mrr_aproximado_por_mes.csv` + `metricas_recurring_vs_non_recurring.csv`

4. **Copiar al dashboard**:
   ```bash
   cp facturas_historicas_enriquecido.csv dashboard/public/data/
   cp mrr_aproximado_por_mes.csv dashboard/public/data/
   cp metricas_recurring_vs_non_recurring.csv dashboard/public/data/
   ```

---

### Paso 3: Datos manuales (JSONs)

**Tiempo estimado: 5 min**

#### cash_balance.json
Actualizar con el saldo real a cierre de mes:
```json
{
  "current_balance": SALDO_REAL,
  "last_updated": "2026-02-28",
  "history": [
    { "month": "2026-02", "balance": SALDO_REAL },
    ...resto del histórico
  ]
}
```

#### contracts.json
Revisar si en febrero hubo:
- Nuevos contratos firmados
- Renovaciones
- Cambios de precio / scope
- Bajas o cancelaciones

#### contract_events.json
Si hubo cambios en contratos, registrar el evento correspondiente.

#### billing_clients.json
Si hay clientes nuevos, añadir sus datos fiscales.

---

### Paso 4: Verificación

- [ ] Abrir `http://localhost:3000` y verificar que los KPIs reflejan febrero
- [ ] Comprobar que el gráfico de ingresos mensuales incluye febrero
- [ ] Verificar MRR/ARR en la página `/mrr`
- [ ] Confirmar que el cashflow en `/cashflow` tiene los gastos de febrero
- [ ] Revisar `data_quality_report.txt` por anomalías

---

### Paso 5: Deploy

```bash
cd dashboard
git add public/data/
git commit -m "data: actualización mensual febrero 2026"
git push
# Vercel despliega automáticamente
```

---

## Automatización rápida

Usa el script `update_month.sh` en la raíz del proyecto para automatizar los pasos 2 y 4:

```bash
# Ejecutar desde la raíz del proyecto (dashboard_financiero/)
./update_month.sh
```

Este script:
- Regenera datos derivados de facturas
- Recalcula MRR y métricas recurring
- Copia todos los CSVs al dashboard
- Muestra un resumen de lo actualizado

> **Nota**: Los pasos 1 (banco) y 3 (JSONs) requieren intervención manual y no se automatizan.

---

## Categorías de gastos (referencia)

| Categoría | Subcategorías | Notas |
|-----------|--------------|-------|
| Salarios | Personal, SS | Nóminas + Seguridad Social |
| Operaciones | Comisiones, Tarjeta, Apps, Equipamiento, Oficina | AWS, Google, Notion, etc. |
| Outsourcing | Brooktec, Bneo, Ala Delta, Finovatech, etc. | Proveedores de desarrollo |
| Profesionales | Legal, Asesoría | |
| Marketing | Eventos | |
| Impuestos | Impuestos | |
| Financiación | - | Excluida del burn rate |

---

## Distinción SAM vs SAN

| Código | Entidad | Estado | Impacto |
|--------|---------|--------|---------|
| **SAM** | Santander Asset Management | ACTIVO (facturación) | Incluir en MRR/ARR |
| **SAN** | Banco Santander (global) | PIPELINE (sin contrato) | Solo en pipeline, nunca en métricas |

> Si aparece "Santander" sin especificar, **verificar antes de actuar**.

---

## Ficheros que tienden a quedarse atrás

| Fichero | Frecuencia necesaria | Última actualización |
|---------|---------------------|---------------------|
| `mrr_aproximado_por_mes.csv` | Mensual | Verificar cada cierre |
| `metricas_recurring_vs_non_recurring.csv` | Mensual | Verificar cada cierre |
| `cash_balance.json` | Mensual | Requiere dato real del banco |
