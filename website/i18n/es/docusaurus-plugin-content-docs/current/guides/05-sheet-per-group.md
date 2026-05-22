---
sidebar_label: '05 · Una hoja por grupo'
pagination_label: '05 · Una hoja por grupo'
---

# 05 · Una hoja por grupo

## Escenario

El mismo informe de renovaciones, un único archivo, pero con una hoja separada para cada región. Además, una hoja "no renovables" que filtra a una lista concreta de estados.

## Estrategia: usar la clave de grupo en el nombre de la hoja plantilla

El nombre de la hoja plantilla es la propia plantilla. xl3 expande una hoja por cada valor distinto de la clave de grupo usando el contenido de la plantilla.

```text
Nombre de hoja plantilla:  Region-{{ [Region] }}
```

xl3 lee el nombre literal `Region-{{ [Region] }}`, agrupa las filas de origen por `Region` y emite una hoja por región con el nombre resuelto: `Region-Madrid`, `Region-Barcelona`, etc.

## `__config__`

| clave | valor |
|---|---|
| `source_sheet` | `Datos` |
| `source_table` | `1` |
| `output_file_pattern` | `regiones.xlsx` |

## Plantilla (nombre de hoja `Region-{{ [Region] }}`)

| Celda | Valor |
|---|---|
| A1 | `Cliente` |
| B1 | `Renovación` |
| A2 | `{{ [Cliente] }}` |
| B2 | `{{ [Renovacion] }}` |
| A3 | `Total` |
| B3 | `{{ SUM([Renovacion]) }}` |

## Datos

| Cliente | Region | Renovacion |
|---|---|---:|
| Acme | Madrid | 18400 |
| Beta | Barcelona | 7200 |
| Coreon | Madrid | 25100 |

## Resultado (`regiones.xlsx`)

- Hoja `Region-Madrid`: Acme, Coreon, Total=43500.
- Hoja `Region-Barcelona`: Beta, Total=7200.

## Filtrar una hoja por una lista nombrada

Patrón habitual: una hoja por grupo, más una hoja "renovaciones &lt; 5k" filtrada por una lista de estados. Usa `__lists__`:

```text
__lists__:
  status_active: ["Activo", "Renovando"]
  status_inactive: ["Cancelado", "Caducado"]
```

Y en una hoja plantilla:

```text
Nombre de hoja plantilla: En-Riesgo
A1: Cliente | B1: Estado | C1: Renovación
A2: {{ @filter [Estado] in __lists__[status_active] }}{{ @filter [Renovacion] < 5000 }}{{ [Cliente] }}
B2: {{ [Estado] }}
C2: {{ [Renovacion] }}
```

Varias directivas `@filter` en un mismo bloque se combinan con AND. Cada filtro estrecha el resultado anterior.

## Notas

- El saneado del nombre de hoja sigue el límite de 31 caracteres de Excel y sus caracteres prohibidos (`[ ] / \ ? *`). Los valores saneados que colisionan son comportamiento definido por la implementación según ADR-0021 — mantén las claves de grupo distintas en el origen.
- Clave de grupo vacía → literal `(blank)` según ADR-0026.
- El orden de las hojas es "primero en aparecer" según ADR-0016.
