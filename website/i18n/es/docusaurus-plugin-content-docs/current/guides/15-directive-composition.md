---
sidebar_label: '15 · Componer directivas'
pagination_label: '15 · Componer directivas'
---

# 15 · Componer directivas (`@filter`, `@sort`, `@top`, `@source`, `@join`)

## Qué son y qué no son las directivas

Las directivas (`@filter`, `@sort`, `@top`, `@source`, `@join`) viven dentro de un **bloque de datos** y dan forma al conjunto de filas que el bloque itera. Se evalúan en un orden fijo independientemente del orden de las celdas en el origen:

1. **`@source <Name>`** — elige la fuente sobre la que itera el bloque.
2. **`@join <Source> on ...`** — empareja filas primarias con filas de otra fuente.
3. **`@filter <condicion>`** — conserva las filas en las que la condición es verdadera.
4. **`@sort <columna> [asc|desc]`** — ordena las filas.
5. **`@top <N>`** — conserva las primeras N filas tras filtrar y ordenar.

Consejo de autoría: pon las directivas en el orden en que se ejecutan. No lo exige la especificación — pero hace la plantilla legible.

## Componerlas

Forma habitual: top 5 de renovaciones de alto valor en Madrid.

```text
{{ @filter [Region] = "Madrid" }}
{{ @filter [Importe] > 1000 }}
{{ @sort [Importe] desc }}
{{ @top 5 }}
{{ [Cliente] }} | {{ [Importe] }}
```

Orden de evaluación:
1. Filtrar Region=Madrid.
2. Filtrar Importe>1000 (se combina con AND).
3. Ordenar las filas supervivientes por Importe descendente.
4. Tomar las 5 primeras.

## Varios `@filter` se combinan con AND

Según ADR-0029, varios `@filter` en un mismo bloque se combinan con AND. No hay palabra clave `OR`. Para expresar OR, una de tres:

- Combinar en un único filtro con `IN`:
  `{{ @filter [Region] in __lists__[active_regions] }}`
- Dividir en dos bloques de datos (cada uno en su propia región de la plantilla) y dejar que los conjuntos de filas se unan por el simple hecho de renderizarse ambos.
- Preprocesar en el origen.

## Componer `@source` + `@join`

```text
{{ @source Renovaciones }}
{{ @join Clientes on Renovaciones[customer_id] = Clientes[id] }}
{{ @filter Clientes[tier] = "A" }}
{{ @sort Renovaciones[amount] desc }}
{{ @top 10 }}
{{ Renovaciones[customer_id] }}
{{ Clientes[name] }}
{{ Renovaciones[amount] }}
```

Pasos:
1. Iterar Renovaciones (por `@source`).
2. Inner-join con Clientes por id; las filas sin coincidencia se descartan.
3. Conservar solo las filas unidas donde la categoría de Clientes es "A".
4. Ordenar por Renovaciones.amount descendente.
5. Tomar las 10 primeras.

`@filter` puede referenciar columnas de cualquiera de las fuentes; la resolución de columnas usa la fuente del bloque activo para los corchetes "pelados" y la forma explícita `Source[Column]` para el lado unido.

## Composiciones prohibidas

Según ADR-0029:

- **Como máximo un `@source`** por bloque de datos. Los duplicados lanzan `xl3/directive/invalid-syntax`.
- **Como máximo un `@join`** por bloque de datos. El multi-join queda fuera del alcance.
- **Nada de self-join**. `@join S on S[a] = S[b]` donde `S` es la fuente activa lanza `xl3/join/bad-on-clause`.

## `@top` tras `@sort`

```text
{{ @sort [Importe] desc }}
{{ @top 10 }}
```

Top-N no tiene sentido sin un orden. Si escribes `@top` sin `@sort`, obtienes las primeras N filas en orden de origen — puede ser útil, pero rara vez es lo que el autor quiere decir.

## Vacío tras filtrar

Si `@filter` descarta todas las filas, el bloque de datos se expande a cero filas. El estilo y los formatos de la fila plantilla permanecen en la salida, pero no se produce ninguna fila de datos. Las filas de pie por debajo del bloque siguen siendo visibles.

## Referencias de especificación

- ADR-0029 — Composición de directivas + semántica de bordes de fuente.
- [`spec/language.md`](../../spec/language.md) "Filter", "Sort", "Top", "Source", "Join".
- [Receta 05](./05-sheet-per-group.md) para `@filter in __lists__[…]`.
- [Receta 07](./07-multi-source-join.md) para lo básico de `@source` + `@join`.
- [Receta 09](./09-sort-and-top.md) para lo básico de `@sort` + `@top`.
