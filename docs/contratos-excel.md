# GPT Finance - Excel de Contratos
## Documentación lógica para el Dashboard

Este Excel contiene información **contractual** diseñada para **complementar** el dashboard financiero de GPT Finance, que ya calcula ingresos reales a partir de **facturación**.

> **Importante:**
> Este Excel **NO sustituye** a la facturación y **NO debe usarse para recalcular ingresos históricos reales**.

---

## Contexto general

El modelo de ingresos combina:

- **Parte recurrente contractual** (licencias, módulos, fee base)
- **Parte variable** dependiente del consumo de tokens

El consumo variable:
- no está fijado en contrato
- solo se conoce a mes vencido
- solo existe cuando se emite la factura

Por este motivo:
- El **ARR / MRR real** se calcula a partir de **facturas**
- Este Excel sirve para **seguimiento contractual y análisis de negocio**, no para contabilidad

---

## Estructura del archivo

El Excel contiene **dos hojas**, con roles claramente separados:

1. `contracts` → estado actual de los contratos (snapshot)
2. `contract_events` → histórico de cambios contractuales

---

## Hoja 1: `contracts`

Representa el estado actual de cada contrato (snapshot).

### Identificación y relación

| Campo | Descripción |
|-------|-------------|
| `client_id` | Identificador interno del cliente. Se utiliza para identificar de forma única al cliente más allá del nombre. |
| `client_name` | Nombre comercial del cliente. Útil para visualización, agrupaciones y reporting. |
| `contract_id` | Identificador único del contrato. Clave principal del contrato y referencia para relacionar con Contract_Events. |

### Estado y producto

| Campo | Descripción |
|-------|-------------|
| `status` | Estado actual del contrato. Ejemplos típicos: activo, cancelado, finalizado. Solo los contratos activos deben considerarse para métricas actuales. |
| `product` | Producto o solución contratada. Permite segmentar ARR por producto o línea de negocio. |

### Fechas contractuales

| Campo | Descripción |
|-------|-------------|
| `start_date` | Fecha de inicio del contrato. |
| `end_date` | Fecha de finalización del contrato (si existe). Puede ser nula en contratos indefinidos o en vigor. |

### Facturación y moneda

| Campo | Descripción |
|-------|-------------|
| `billing_frequency` | Frecuencia de facturación acordada en el contrato (por ejemplo: mensual, trimestral, anual). |
| `currency` | Moneda en la que está denominado el contrato. |

### Setup / one-off

| Campo | Descripción |
|-------|-------------|
| `set_up` | Importe de setup inicial o fee one-off asociado al contrato. No recurrente. **No debe incluirse en ARR contratado ni MRR contratado.** |

### Valor base del contrato (firma inicial)

| Campo | Descripción |
|-------|-------------|
| `base_contract_value_annual` | Valor anual del contrato en el momento de la firma. No incluye expansiones ni IPC posteriores. |
| `base_mrr_eur` | MRR base del contrato, expresado en EUR, en el momento de la firma. |
| `base_arr_eur` | ARR base del contrato, expresado en EUR, en el momento de la firma. |

> Estos campos representan el contrato original, no el estado actual.

### Renovación y preaviso

| Campo | Descripción |
|-------|-------------|
| `renewal_type` | Tipo de renovación del contrato (por ejemplo: automática, manual, anual, indefinida, etc.). |
| `notice_days` | Días de preaviso requeridos para cancelación o no renovación. |

### IPC (ajustes por inflación)

| Campo | Descripción |
|-------|-------------|
| `ipc_applicable` | Indica si el contrato está sujeto a actualización por IPC (booleano o equivalente). |
| `ipc_frequency` | Frecuencia con la que se aplica el IPC (por ejemplo: anual). |
| `ipc_applicationmonth` | Mes en el que se aplica el ajuste por IPC (por ejemplo: enero). |

### Precio actual vigente

| Campo | Descripción |
|-------|-------------|
| `current_price_annual` | Precio anual vigente del contrato. Incluye: contrato base, expansiones activas, ajustes por IPC aplicados. **No incluye consumo variable.** |
| `current_mrr` | MRR contractual vigente del contrato. Normalmente `current_price_annual / 12`. |

> Estos campos son la fuente de verdad del estado contractual actual.

### Gestión comercial

| Campo | Descripción |
|-------|-------------|
| `account_owner` | Responsable interno de la cuenta / cliente. Útil para reporting comercial y ownership. |

---

## Hoja 2: `contract_events`

Representa el histórico de eventos que modifican el contrato.

### Identificación

| Campo | Descripción |
|-------|-------------|
| `event_id` | Identificador único del evento contractual. |
| `contract_id` | Identificador del contrato afectado. Relación directa con `contracts.contract_id`. |
| `client_name` | Nombre del cliente asociado al evento. Campo redundante para facilitar análisis y visualización. |

### Tipo y fecha del evento

| Campo | Descripción |
|-------|-------------|
| `event_date` | Fecha en la que se registra el evento. |
| `event_type` | Tipo de evento contractual. Ejemplos típicos: alta / new business, expansión, downgrade, cancelación. |

### Impacto económico del evento

| Campo | Descripción |
|-------|-------------|
| `arr_delta` | Variación de ARR causada por el evento. Positivo = expansión / alta. Negativo = downgrade / cancelación. |
| `mrr_delta` | Variación de MRR causada por el evento. Normalmente `arr_delta / 12`. |

### Moneda

| Campo | Descripción |
|-------|-------------|
| `currency` | Moneda en la que está expresado el impacto del evento. |

### Contexto del evento

| Campo | Descripción |
|-------|-------------|
| `reason` | Motivo principal del evento (por ejemplo: nuevos módulos, renegociación, cancelación, etc.). |
| `effective_from` | Fecha desde la cual el evento tiene efecto económico real. Puede diferir de `event_date`. |
| `notes` | Campo de texto libre para aclaraciones adicionales. |
