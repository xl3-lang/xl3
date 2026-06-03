---
sidebar_label: '09 · Ordenar y Top-N'
pagination_label: '09 · Ordenar y Top-N'
---

# 09 · Ordenar y Top-N

## Escenario

Mostrar las 10 renovaciones más altas por importe, en orden descendente. O un orden multiclave: por región (alfabético) y luego por importe (descendente).

## `@sort`

```text
{{ @sort [Renovacion] desc }}
{{ [Cliente] }} | {{ [Renovacion] }}
```

La dirección es `asc` (por defecto) o `desc`. `@sort` es **estable** — las filas con claves iguales conservan su orden original (primero en aparecer).

## Orden multiclave

```text
{{ @sort [Region] asc }}
{{ @sort [Renovacion] desc }}
{{ [Cliente] }} | {{ [Region] }} | {{ [Renovacion] }}
```

El primer `@sort` es la clave **primaria**; los `@sort` posteriores son criterios de desempate (convención Excel/SQL). Arriba: las filas se agrupan por Región alfabéticamente; dentro de cada Región, se ordenan por Renovación descendente.

## `@top`

```text
{{ @sort [Renovacion] desc }}
{{ @top 10 }}
{{ [Cliente] }} | {{ [Renovacion] }}
```

`@top N` conserva las primeras `N` filas después de todos los filtros y ordenamientos. Pon `@top` DESPUÉS de `@sort` — primero ordenas, luego tomas las primeras.

Si `N` supera el número de filas disponibles, `@top` no hace nada (devuelve todas las filas). Un `N` negativo o cero produce un bloque vacío.

## Combinar con `@filter`

```text
{{ @filter [Renovacion] > 1000 }}
{{ @sort [Renovacion] desc }}
{{ @top 5 }}
{{ [Cliente] }} | {{ [Renovacion] }}
```

Orden: filtro → orden → top. Varios `@filter` se combinan con AND (cercano a ADR-0029; véase la [Receta 05](./05-sheet-per-group.md) para filtros por lista).

## Semántica de comparación

`@sort` usa la comparación estándar de XTL:

- Números o cadenas numéricas: numérica.
- Booleanos: `false < true`.
- Fechas: marca de tiempo.
- En el resto: forma canónica de cadena en orden por punto de código Unicode. **Sin ordenación por configuración regional.** "Z" < "a" (mayúsculas < minúsculas en ASCII).

Si tus operadores quieren ordenación sensible al idioma, preordena en el origen o añade una columna con clave de ordenación.

## Notas

- "Orden estable" significa que las claves iguales conservan el orden de inserción — crítico cuando se encadenan varios `@sort` como criterios de desempate.
- `@top` tras `@sort` es el patrón canónico de "top N". `@top` solo (sin `@sort`) devuelve las primeras N filas en el orden del origen.
- Referencia de especificación: [`spec/language.md`](/es/spec/language) "Sort" y "Top"; ADR-0016.
