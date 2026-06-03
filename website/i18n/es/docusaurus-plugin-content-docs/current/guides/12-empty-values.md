---
sidebar_label: '12 · Valores vacíos en profundidad'
pagination_label: '12 · Valores vacíos en profundidad'
---

# 12 · Valores vacíos en profundidad

## Qué significa "vacío" en XTL

Según ADR-0007:

- **Vacío**: missing/null/undefined, O una cadena formada solo por espacios Unicode.
- **NO vacío**: el número `0`, el booleano `false`, cualquier cadena no en blanco, cualquier fecha.

Las cadenas `"0"` y `"false"` son no vacías. Para filtrarlas, compara explícitamente: `[Importe] != "0"`.

## `IFEMPTY` — respaldo para valores ausentes

```text
{{ IFEMPTY([Responsable], "Sin asignar") }}
{{ IFEMPTY([Nota], "—") }}
{{ IFEMPTY([Region], __config__[default_region]) }}
```

`IFEMPTY(value, fallback)` devuelve `fallback` solo cuando `value` está vacío. NO se dispara con `0` ni con `false`.

## Vacío vs. cero — un error frecuente

```text
{{ IFEMPTY([Importe], "n/d") }}        → "0" (el número) en una fila con importe cero
{{ IF([Importe] = 0, "n/d", [Importe]) }} → "n/d" en una fila con importe cero
```

Si quieres que tanto "ausente" como "cero" se lean como `n/d`:

```text
{{ IF(IFEMPTY([Importe], 0) = 0, "n/d", [Importe]) }}
```

## Claves de grupo vacías → `(blank)`

Según ADR-0026, una fila con la clave de grupo vacía produce:

- Un archivo llamado `(blank).xlsx` si se usa en `output_file_pattern`.
- Una hoja llamada `(blank)` si se usa en el nombre de una hoja plantilla.

Esto coincide con la convención de tablas dinámicas de Excel. Si prefieres que falle ruidosamente, filtra en el origen:

```text
{{ @filter [Region] != "" }}        ← descarta filas con Region vacío
```

## Vacío en agregados

`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` saltan los valores vacíos:

```text
datos:    [10, 20, "", 30]
SUM:      60     (no error)
COUNT:    3      (no 4)
AVERAGE:  20     (no 15)
```

`AVERAGE` sobre cero valores no vacíos devuelve vacío (no error). Para detectarlo explícitamente, envuelve en `IFEMPTY`:

```text
{{ IFEMPTY(AVERAGE([Importe]), "sin datos") }}
```

## Vacío en condiciones de `IF`

Reglas de verdad (según ADR-0008):

- Vacío → falso.
- Número `0` → falso.
- Booleano `false` → falso.
- Cadenas `"0"` y `"false"` → **verdaderas** (cadenas no vacías).
- Cualquier fecha → verdadera.

```text
{{ IF([Region], [Region], "Desconocida") }}  → "" si Region es "", si no Region
{{ IF([Importe], [Importe], "sin datos") }}  → "sin datos" si Importe es 0 o vacío
```

## Celdas vacías en celdas con una sola expresión

Según ADR-0026: una celda que solo contiene `{{ expr }}` y se evalúa a vacío produce una celda vacía (sin error). La celda existe en OOXML; su valor es vacío. Releerla con xl3 la lee como vacía según ADR-0007.

Si la celda mezcla literales: `{{ [Importe] }} EUR`, el resultado es `" EUR"` (con el número vacío convertido a cadena vacía + un espacio inicial).

## Referencias de especificación

- [`spec/evaluation.md`](/es/spec/evaluation) "Empty Values".
- ADR-0007 (definición de vacío), ADR-0008 (reglas de verdad), ADR-0026 (ciclo de vida).
- [Receta 02](./02-conditional-cells.md) para lo básico de IF/IFEMPTY.
