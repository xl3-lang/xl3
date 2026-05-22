---
sidebar_label: '01 · Empezar'
pagination_label: '01 · Empezar'
---

# 01 · Empezar en 5 minutos

## Escenario

Tienes un `.xlsx` con renovaciones de clientes. Quieres un informe de una sola hoja con las mismas filas, más una columna "Categoría" derivada del importe de la renovación.

## `__config__`

| clave | valor |
|---|---|
| `source_sheet` | `Datos` |
| `source_table` | `1` |
| `output_file_pattern` | `informe-renovaciones.xlsx` |

## Celdas de plantilla (hoja `Informe`)

| Celda | Valor |
|---|---|
| A1 | `Cliente` |
| B1 | `Región` |
| C1 | `Renovación` |
| D1 | `Categoría` |
| A2 | `{{ [Cliente] }}` |
| B2 | `{{ [Region] }}` |
| C2 | `{{ [Renovacion] }}` |
| D2 | `{{ IF([Renovacion] > 10000, "Prioritario", "Estandar") }}` |

## Datos (hoja `Datos`)

| Cliente | Region | Renovacion |
|---|---|---:|
| Logística Acme | Madrid | 18400 |
| Beta Talleres | Barcelona | 7200 |
| Coreon Alimentos | Madrid | 25100 |

## Resultado (`informe-renovaciones.xlsx`, hoja `Informe`)

| Cliente | Región | Renovación | Categoría |
|---|---|---:|---|
| Logística Acme | Madrid | 18400 | Prioritario |
| Beta Talleres | Barcelona | 7200 | Estándar |
| Coreon Alimentos | Madrid | 25100 | Prioritario |

## Notas

- La fila 2 de la plantilla es el **bloque de datos**. xl3 expande una fila de entrada en una fila de salida, conservando los estilos, formatos numéricos y celdas combinadas de la fila de plantilla.
- `[Cliente]` es una **referencia de columna** — xl3 la resuelve al valor de la columna `Cliente` de la fila actual del origen.
- `{{ ... }}` es un **bloque de plantilla** — todo lo que va dentro se evalúa como una expresión XTL. Los espacios dentro de las llaves no son significativos.
- El bloque de datos se detiene en la primera fila no vacía que no contiene un bloque de plantilla. Si añades una fila de pie de página (por ejemplo, una celda "Total"), permanece en su sitio mientras el bloque de datos se expande por encima.

Véase también: [`spec/language.md`](../../spec/language.md), apartados "Template Blocks" y "Source Columns".
