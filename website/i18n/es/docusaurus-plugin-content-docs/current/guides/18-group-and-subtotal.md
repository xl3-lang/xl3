---
sidebar_label: '18 · Grupos y subtotales'
pagination_label: '18 · Grupos y subtotales'
---

# 18 · Agrupar filas y emitir subtotales

## Escenario

Tu libro de facturas / hojas de liquidación / órdenes de compra tiene filas de líneas divididas en secciones por cliente o por mes, con una línea de subtotal tras cada sección y (opcionalmente) una línea de total general al final:

```
Acme    Producto A    10.000
Acme    Producto B     5.000
        Subtotal      15.000
Beta    Producto A    20.000
        Subtotal      20.000
        Total general 35.000
```

XTL 0.6 trae dos directivas que hacen esto dentro de un único bloque de datos, sin pre-agregar en el origen ni post-procesar la salida (ADR-0038).

## Las dos piezas

### `@group [Key1], [Key2], …`

`@group` particiona el conjunto de filas activo en N niveles anidados para emitir subtotales intercalados. NO reordena las filas — el orden de grupo es el orden de aparición *después* de que `@filter` y `@sort` se hayan aplicado. Combínalo con `@sort` sobre las mismas claves para conseguir un orden de grupo estable.

```text
{{ @sort [Cliente] }}
{{ @group [Cliente] }}
```

### `@subtotal <agregado>`

Una fila que contiene una celda `{{ @subtotal SUM([Importe]) }}` es una **fila de subtotal**. No itera por fila de origen; en su lugar, el renderizador la emite una vez en cada frontera de grupo al nivel asociado a la fila. Los agregados admitidos son `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`.

La primera fila `@subtotal` en orden de origen se vincula a la clave de grupo **más interna**. Apila filas `@subtotal` adicionales debajo para vincular a niveles más externos — la fila más baja se vincula a la clave más externa.

## Agrupación de un solo nivel

```text
{{ @sort [Cliente] }}
{{ @group [Cliente] }}
{{ [Cliente] }} | {{ [Producto] }} | {{ [Importe] }}
"Subtotal"       |                  | {{ @subtotal SUM([Importe]) }}
```

Para tres filas de origen (Acme/Producto/100, Beta/Tornillo/50, Acme/Engranaje/200) esto renderiza:

```
Acme    Producto    100
Acme    Engranaje   200
        Subtotal    300
Beta    Tornillo     50
        Subtotal     50
```

## Anidado de dos niveles + total general

```text
{{ @sort [Region] }}
{{ @sort [Cliente] }}
{{ @group [Region], [Cliente] }}
{{ [Region] }} | {{ [Cliente] }} | {{ [Importe] }}
"Subtotal cliente"  |              | {{ @subtotal SUM([Importe]) }}
"Subtotal región"   |              | {{ @subtotal SUM([Importe]) }}
```

La fila `@subtotal` superior (Subtotal cliente) se vincula a la clave más interna (`[Cliente]`); la siguiente fila (Subtotal región) se vincula a `[Region]`. Ambas emiten en las fronteras; la interna se dispara antes que la externa cuando ambas terminan simultáneamente.

El patrón "total general vía el subtotal más externo": con un único `@group [Cliente]` más dos filas `@subtotal`, la externa se dispara exactamente una vez — al final del bloque de datos — porque la frontera del grupo externo ES el final de los datos.

## Composición con otras directivas

| Directiva | Interacción |
|---|---|
| `@filter` | Los filtros aplican **antes** de agrupar. Las filas filtradas no están en ningún grupo. Un grupo cuyas filas se filtraron por completo simplemente no aparece. |
| `@sort` | Los ordenamientos aplican antes de agrupar. Para fijar el orden de grupo, `@sort` por las mismas claves que `@group` en el mismo orden. |
| `@source` | Cada bloque `@source` tiene su propio ámbito de agrupación. |
| `@join` | Las columnas de filas unidas participan en la agrupación como columnas de filas primarias. Las claves de grupo PUEDEN referenciar columnas unidas. |
| `@top` | Aplica **después** de agrupar al nivel de fila. Los subtotales solo se emiten para grupos cuyas filas de datos sobrevivieron al corte de `@top`. |
| `@repeat right` | Incompatible con `@group` (`xl3/directive/invalid-syntax`). |

## Casos límite

- **Caso degenerado de un solo grupo** — si `@group [Key]` y todas las filas comparten un valor de `[Key]`, el subtotal sigue emitiendo una vez en la frontera de ese grupo. Coincide con el patrón de total general cuando el conjunto de datos contiene un solo valor de grupo externo.
- **Grupos vacíos** — un grupo cuyas filas de datos están todas vacías (según ADR-0007) se omite: ni filas de datos ni `@subtotal` emiten.
- **Argumentos de agregado** — dentro de `@subtotal` solo se aceptan referencias de columna. Las expresiones compuestas (`SUM([A]) - SUM([B])`, `IF(...)`) lanzan `xl3/subtotal/bad-aggregate` y están aplazadas.
- **Celdas con texto literal en una fila `@subtotal`** — perfectamente válido; la etiqueta "Subtotal:" se sitúa junto a la celda del agregado, y ambas se renderizan en cada emisión. Las celdas literales NO DEBEN referenciar columnas de la fila actual; no hay fila actual en una frontera de grupo.

## Errores

- `xl3/group/missing-key` — directiva `@group` sin lista de claves.
- `xl3/subtotal/outside-group` — celda `@subtotal` en un bloque sin `@group`, o más filas `@subtotal` que claves de `@group`.
- `xl3/subtotal/bad-aggregate` — el cuerpo no es uno de `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, o su argumento no es una referencia de columna.

## Véase también

- [ADR-0038 — Directivas `@group` y `@subtotal`](../../spec/decisions/0038-group-and-subtotal.md)
- [`spec/language.md` § "Group + Subtotal"](../../spec/language.md)
- [Receta 03 — Agregados](./03-aggregates.md) — `SUM` / `COUNT` / `AVERAGE` a nivel de bloque sin agrupación
- [Receta 15 — Composición de directivas](./15-directive-composition.md) — reglas completas de orden de directivas
