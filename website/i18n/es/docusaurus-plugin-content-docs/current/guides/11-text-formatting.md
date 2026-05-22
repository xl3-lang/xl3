---
sidebar_label: '11 · Formato con TEXT()'
pagination_label: '11 · Formato con TEXT()'
---

# 11 · Formato con TEXT()

## Escenario

El dinero debe parecer dinero (`€#,##0.00`), las fechas deben verse limpias (`yyyy-mm-dd`), los porcentajes no deben tener ocho decimales (`0.0%`). `TEXT(value, format)` de XTL hace el renderizado.

## Moneda

```text
{{ TEXT([Importe], "€#,##0.00") }}        → "€1.200,00" (depende del locale del lector)
{{ TEXT([Importe], "[$€-es-ES] #,##0") }} → "€ 1.200"
{{ TEXT([Importe], "#,##0;(#,##0)") }}    → negativos entre paréntesis
```

## Fechas

```text
{{ TEXT([FechaPedido], "yyyy-mm-dd") }}      → "2026-05-12"
{{ TEXT([FechaPedido], "yyyy-mm") }}          → "2026-05"
{{ TEXT([FechaPedido], "mmm d, yyyy") }}      → "may 12, 2026"
{{ TEXT(TODAY(), "yyyy-mm-dd") }}             → hoy en UTC (según ADR-0001)
```

`TODAY()` devuelve hoy en UTC. Si la zona horaria del operador importa, pasa la fecha como un valor de `__inputs__` en lugar de llamar a `TODAY()`.

## Porcentajes

```text
{{ TEXT([Margen], "0.0%") }}     → "12,3%" (Margen es 0,1234)
{{ TEXT([Tasa], "0%") }}          → "8%"
```

## Mezclar con concatenación

```text
{{ "Total: " & TEXT(SUM([Importe]), "€#,##0") }}    → "Total: €43.500"
{{ "Ejecución: " & TEXT(TODAY(), "yyyy-mm-dd") }}    → "Ejecución: 2026-05-12"
```

El operador `&` concatena el resultado de `TEXT()` con literales y otro texto. Útil en filas de cabecera, nombres de archivo, nombres de hoja.

## Cuándo NO usar TEXT()

Para la mayoría de celdas, lo más sencillo es el **`numFmt` de la celda de plantilla**:

- Configura la celda con formato `€#,##0.00` en Excel.
- Referencia el número en bruto: `{{ [Importe] }}`.
- xl3 conserva el formato de la celda en la salida.

Así la celda mantiene tipo numérico — Excel puede seguir sumándola, filtrándola, etc. `TEXT()` fuerza una celda de tipo cadena. Usa `TEXT()` cuando:

- Necesitas el valor formateado dentro de una concatenación de cadenas.
- Necesitas un formato que el `numFmt` de la celda no puede expresar.
- La salida va a un consumidor que no aplica el formato de la celda (por ejemplo, un consumidor de CSV).

## Formatos admitidos

xl3 soporta la tabla básica de formatos de Excel. Los formatos fuera de la tabla básica son comportamiento definido por la implementación según ADR-0021 — mantén `template.xlsx` portable ciñéndote a los tokens convencionales de Excel.

## Referencias de especificación

- [`spec/language.md`](../../spec/language.md) "TEXT" + la tabla básica de formatos.
- ADR-0001 (`TODAY()` es UTC).
- ADR-0017 (modelo de valor para fechas).
- ADR-0021 (las cadenas de formato personalizadas son definidas por la implementación).
