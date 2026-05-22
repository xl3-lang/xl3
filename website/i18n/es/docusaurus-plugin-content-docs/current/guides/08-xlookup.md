---
sidebar_label: '08 · XLOOKUP'
pagination_label: '08 · XLOOKUP'
---

# 08 · `XLOOKUP`

## Escenario

Quieres traer una sola columna desde otra fuente emparejando por una clave. Como un `VLOOKUP` / `INDEX(MATCH(...))` puntual o un `LEFT JOIN ... LIMIT 1` de SQL.

## Forma básica

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, fallback) }}
```

- `lookup_value` — el valor que quieres encontrar.
- `lookup_array` — la columna de la otra fuente en la que buscar.
- `return_array` — la columna de la otra fuente desde la que devolver.
- `fallback` (opcional) — valor a devolver cuando no hay coincidencia.

Se devuelve el valor de `return_array` de la primera fila que coincide. La comparación sigue el algoritmo estándar de XTL (numérica entre números o cadenas numéricas, por punto de código en cadenas). Sin comodines, sin coincidencia aproximada, sin búsqueda en reverso — esos casos quedan fuera del alcance según ADR-0013.

## Ejemplo

`__sources__`:

| name | sheet | table |
|---|---|---|
| `Clientes` | `Clientes` | `1` |

Celdas de plantilla:

```text
A2: {{ [customer_id] }}
B2: {{ XLOOKUP([customer_id], Clientes[id], Clientes[name]) }}
C2: {{ XLOOKUP([customer_id], Clientes[id], Clientes[tier]) }}
```

Para cada fila de la fuente por defecto, xl3 encuentra la fila de Clientes que coincide por `id` y extrae `name` / `tier`.

## Comportamiento cuando no hay coincidencia

Si `lookup_value` no está en `lookup_array` y no se proporciona `fallback`, xl3 lanza `xl3/xlookup/no-match`. La especificación prefiere fallar de forma ruidosa antes que devolver datos faltantes en silencio.

Para suprimir el error, pasa un valor de respaldo como 4.º argumento:

```text
{{ XLOOKUP([customer_id], Clientes[id], Clientes[name], "(desconocido)") }}
```

Cuando no hay coincidencia, se devuelve el valor de respaldo. Para permitir las ausencias sin marcador, filtra en el origen o usa `@join` (descarta filas sin coincidencia).

## Protección contra mezcla de fuentes

`lookup_array` y `return_array` DEBEN ser columnas de la misma fuente. `XLOOKUP([id], Clientes[id], Renovaciones[name])` lanza `xl3/xlookup/source-mismatch` — mezclar fuentes implicaría devolver un valor desde una posición de fila sin relación significativa con la fila coincidente.

## Rendimiento

xl3 construye un índice en el primer `XLOOKUP` sobre un par `(filas, columna)`, de modo que las búsquedas siguientes contra la misma columna son O(1). La primera búsqueda en una ejecución de conversor paga el coste O(N); las búsquedas en el mismo bloque de datos son entonces de tiempo constante.

## Notas

- La comparación es consciente del tipo: número-o-cadena-numérica cruza la frontera, así que `XLOOKUP("42", Clientes[id], ...)` encuentra una fila cuyo `id` es el número `42`.
- Usa `@join` cuando cada fila primaria deba emparejarse con la fila unida; usa `XLOOKUP` cuando quieras una celda procedente de otra fuente.
- Referencia de especificación: [`spec/language.md`](../../spec/language.md) "XLOOKUP"; ADR-0013.
