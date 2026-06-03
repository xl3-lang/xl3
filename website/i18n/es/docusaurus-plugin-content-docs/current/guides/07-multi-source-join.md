---
sidebar_label: '07 · Múltiples fuentes y @join'
pagination_label: '07 · Múltiples fuentes y @join'
---

# 07 · Múltiples fuentes + `@join`

## Escenario

Los datos de renovaciones tienen un `customer_id`, pero el nombre completo del cliente vive en una tabla `Clientes` separada. Quieres filas de renovaciones con el `Nombre` y la `Categoría` del cliente ya unidos.

## Declarar las fuentes en `__sources__`

| name | sheet | table | description |
|---|---|---|---|
| `Renovaciones` | `Renovaciones` | `1` | filas por renovación |
| `Clientes` | `Clientes` | `1` | una fila por cliente |

El `source_sheet` por defecto de `__config__` sigue siendo implícito; se referencia como `[Column]` sin prefijo de fuente. Las fuentes nombradas se referencian como `SourceName[Column]`.

## `@source` para cambiar la fuente activa del bloque

```text
{{ @source Renovaciones }}
{{ [customer_id] }}   ← los corchetes "pelados" se resuelven contra Renovaciones
{{ [amount] }}
```

Por defecto, el bloque de datos itera sobre la `source_sheet` configurada. `@source <Name>` lo redirige a `<Name>` solo para ese bloque.

## `@join` para emparejar filas primarias con filas de otra fuente

```text
{{ @source Renovaciones }}
{{ @join Clientes on Renovaciones[customer_id] = Clientes[id] }}
{{ [customer_id] }}             ← fila de Renovaciones
{{ Clientes[name] }}             ← fila de cliente unida
{{ Clientes[tier] }}
{{ [amount] }}
```

`@join` es **inner-join, primera coincidencia**:

- Para cada fila de Renovaciones, busca la PRIMERA fila de Clientes donde `id = customer_id`.
- Si no hay coincidencia, la fila de Renovaciones se descarta.
- Coincidencias múltiples: solo se usa la primera.

La cláusula `on` debe referenciar ambas fuentes por nombre. Los self-joins (`@join S on S[a] = S[b]` donde `S` es la fuente activa) lanzan `xl3/join/bad-on-clause` según ADR-0029.

## Traer valores entre fuentes sin unir: `XLOOKUP`

Si no necesitas emparejar cada fila de Renovaciones con una fila de Clientes, `XLOOKUP` es más ligero:

```text
{{ XLOOKUP([customer_id], Clientes[id], Clientes[name]) }}
```

Véase la [Receta 08](./08-xlookup.md).

## Agregados entre fuentes

Los agregados sobre una fuente nombrada operan sobre la **fuente completa**, no sobre el bloque unido/filtrado:

```text
{{ COUNT(Clientes[id]) }}        ← total de clientes, ignora los filtros
{{ SUM(Renovaciones[amount]) }}   ← total de renovaciones, ignora los filtros
```

Véase la [Receta 03](./03-aggregates.md).

## Notas

- Un solo `@source` y un solo `@join` por bloque de datos. Las duplicaciones lanzan `xl3/directive/invalid-syntax` según ADR-0029.
- El multi-join (encadenar varios `@join`) está aplazado según ADR-0014.
- Los nombres de función se comparan sin distinguir mayúsculas: `if`, `If`, `IF`.
- Referencia de especificación: [`spec/evaluation.md`](/es/spec/evaluation) "External Data Sources"; ADR-0012, ADR-0014.
