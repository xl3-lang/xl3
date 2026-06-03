---
sidebar_label: '03 · Agregados'
pagination_label: '03 · Agregados'
---

# 03 · Agregados sobre filas

## Escenario

Añadir una fila de pie de página que totalice el bloque de datos de arriba. O traer un agregado entre fuentes (por ejemplo, el total global de la empresa) a una celda de cabecera.

## Agregado con corchetes — opera sobre el bloque de datos

```text
{{ SUM([Renovacion]) }}
{{ COUNT([Renovacion]) }}
{{ AVERAGE([Renovacion]) }}
{{ MIN([Renovacion]) }}
{{ MAX([Renovacion]) }}
```

Dentro del **bloque de datos**, se acumulan sobre las filas de origen que se iteran. En una **fila de pie de página** (una fila por debajo del bloque de datos, sin bloque de plantilla en la fila del bloque), la misma expresión hace referencia al bloque recién expandido.

```text
| A1: Cliente     | B1: Renovación             |
| A2: {{ [Cliente] }}| B2: {{ [Renovacion] }}     | ← bloque de datos
| A3: Total       | B3: {{ SUM([Renovacion]) }}| ← pie de página
```

Tras expandir con 3 filas de origen, la fila 3 pasa a ser la fila 5, y `B5` muestra la suma de los tres valores de `Renovacion`.

## Agregado calificado por fuente — opera sobre TODA la fuente

```text
{{ SUM(Renovaciones[Importe]) }}        # fuente completa, no el bloque activo
{{ COUNT(Clientes[Cliente]) }}
```

Cuando escribes `SUM(NombreFuente[Columna])`, xl3 suma sobre la fuente nombrada **completa**, no sobre el bloque filtrado o unido. Úsalo para celdas de "total global" en cabeceras que no deben cambiar cuando el bloque se filtra.

`Renovaciones` es un nombre declarado en `__sources__`. Véase la [Receta 07](./07-multi-source-join.md).

## El filtro cambia el bloque, no la fuente

```text
{{ @filter [Region] = "Madrid" }}
{{ [Cliente] }}    | {{ [Renovacion] }}
Total:              | {{ SUM([Renovacion]) }}        # solo filas de Madrid
Global:             | {{ SUM(Source[Renovacion]) }}  # todas las filas
```

`SUM([Renovacion])` refleja el bloque tras filtrar. `SUM(Source[Renovacion])` ignora el filtro.

## Lo que no funciona — aritmética dentro de un agregado

El argumento único de `SUM`, `AVERAGE`, `MIN`, `MAX` y `COUNT` (con 1 argumento) DEBE ser una referencia de columna (`[Columna]` o `Source[Columna]`). La aritmética por fila, los literales y las llamadas a función dentro del agregado se **rechazan** en tiempo de parsing con `xl3/eval/bad-aggregate-arg` (ADR-0059):

```text
{{ SUM([Cantidad] * [Precio]) }}     # ✗ aritmética por fila — rechazado
{{ SUM(1 + 2) }}                      # ✗ expresión literal — rechazado
{{ SUM(IF([Region]="Madrid", [Importe], 0)) }}   # ✗ llamada a función — rechazado
{{ AVERAGE([Ventas] - [Coste]) }}     # ✗ resta por fila — rechazado
```

Es intencional. La semántica de `SUMPRODUCT` y fórmulas de matriz de Excel (calcular por fila y luego agregar) queda fuera del alcance de XTL 0.x — véase ADR-0059 § "Why not allow `SUM([a] + [b])`".

### Solución: columna auxiliar en el origen

El patrón canónico (ingresos = Σ cantidad × precio) se expresa añadiendo el producto por fila como columna en el **libro de origen** y luego sumando esa columna:

```text
# En los datos de origen, añade una columna "Importe":
| Cantidad | Precio | Importe        |
|        3 |    100 |   =B2*C2  (o 300 precalculado) |
|        2 |    150 |   =B3*C3  (o 300)              |

# En la plantilla:
{{ SUM([Importe]) }}             # ✓ — suma la columna precalculada
```

Si el origen se genera por programa, escribe directamente el resultado de la multiplicación en la columna. Si el origen se mantiene a mano, usa una fórmula normal de Excel en la columna `Importe`.

### Solución: celda por fila + agregado en pie de página

Si solo necesitas que el producto por fila se vea (sin sumarlo) en la salida expandida, calcúlalo fila a fila en una celda de plantilla:

```text
| {{ [Cantidad] }} | {{ [Precio] }} | {{ [Cantidad] * [Precio] }} |   # ✓ por fila
```

Esto funciona porque `{{ [Cantidad] * [Precio] }}` se evalúa por cada fila iterada. **No** es lo mismo que `SUM([Cantidad] * [Precio])` — para tener además un total en pie de página de esos productos, vuelve a la solución de la columna auxiliar de arriba (o usa una fórmula nativa de Excel `SUMPRODUCT` en la celda del pie, que xl3 conserva tal cual según ADR-0046).

## Notas

- Los agregados ignoran los valores vacíos según ADR-0007.
- `COUNT` cuenta valores no vacíos. Para contar todas las filas, incluidas las vacías, usa `COUNT(Source[any-required-col])` sobre una columna que nunca esté vacía.
- `AVERAGE` sobre cero valores no vacíos devuelve vacío, no error.
- Las expresiones compuestas dentro del agregado (literal, aritmética, llamada a función) lanzan `xl3/eval/bad-aggregate-arg` según ADR-0059.
- Referencia de especificación: [`spec/language.md`](/es/spec/language) "Aggregates"; ADR-0012 para la semántica de fuentes; ADR-0059 para la regla sobre la forma del argumento.
