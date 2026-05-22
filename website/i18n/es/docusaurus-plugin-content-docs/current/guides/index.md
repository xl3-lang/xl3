---
slug: /guides
sidebar_label: 'Resumen'
pagination_label: 'Resumen'
---

# Guías de XTL

Una colección de recetas cortas, listas para copiar y pegar, pensadas para los flujos de trabajo de informes más habituales. Cada receta es una página breve en Markdown con escenario, celdas de plantilla y resultado esperado.

Estas guías complementan dos recursos ya existentes:

- **[`examples/`](https://github.com/jinyoung4478/xl3/tree/main/examples/)** contiene cuatro plantillas ejecutables que muestran combinaciones completas de extremo a extremo. Copia una como punto de partida.
- **[`spec/language.md`](../spec/language.md)** es la referencia formal de cada función y directiva (en inglés). Consúltala cuando te encuentres con un caso que las recetas no cubren.

Las recetas de aquí priorizan "la plantilla más pequeña que demuestra X" sobre "el realismo de producción" — el objetivo es que las consultes rápido cuando recuerdas la forma pero la sintaxis se te escapa.

## Recetas

| # | Receta | Qué aprenderás |
|---|---|---|
| 01 | [Empezar en 5 minutos](./01-getting-started.md) | Plantilla + datos → resultado. Sustituciones y `__config__`. |
| 02 | [Celdas condicionales](./02-conditional-cells.md) | `IF`, `IFEMPTY`, operadores de comparación, valores verdaderos/falsos. |
| 03 | [Agregados por fila](./03-aggregates.md) | `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` — por bloque vs. fuente completa. |
| 04 | [Un archivo por grupo](./04-file-per-group.md) | Agrupar archivos con `output_file_pattern`. |
| 05 | [Una hoja por grupo](./05-sheet-per-group.md) | Agrupar hojas + filtros basados en listas. |
| 06 | [Entradas en tiempo de ejecución](./06-runtime-inputs.md) | `__inputs__` para valores por ejecución (mes, región, etc.). |
| 07 | [Múltiples fuentes + `@join`](./07-multi-source-join.md) | `__sources__`, `@source`, `@join`. |
| 08 | [`XLOOKUP`](./08-xlookup.md) | Búsqueda entre fuentes. |
| 09 | [Ordenar y Top-N](./09-sort-and-top.md) | `@sort` (estable), `@top`, ordenamiento multiclave. |
| 10 | [Estilos y marca](./10-styling-and-branding.md) | `tabColor`, celdas combinadas, `numFmt`, `TEXT()`. |
| 11 | [Formato con `TEXT()`](./11-text-formatting.md) | Moneda, fechas, porcentajes. Cuándo usar `numFmt` y cuándo `TEXT()`. |
| 12 | [Valores vacíos en profundidad](./12-empty-values.md) | `IFEMPTY`, trampas entre vacío y 0, `(blank)`, agregados sobre datos dispersos. |
| 13 | [Manejo de errores para hosts](./13-error-handling.md) | Capturar `XtlError`, catálogo de códigos, `preview()` para fallar pronto. |
| 14 | [`__config__` como diccionario de valores](./14-config-values.md) | Claves definidas por el autor, conciencia de tipos, `__config__` vs. `__inputs__`. |
| 15 | [Componer directivas](./15-directive-composition.md) | Orden de ejecución, combinación AND de varios `@filter`, composiciones prohibidas. |
| 16 | [Funciones XTL vs. fórmulas de Excel](./16-xtl-vs-excel-formula.md) | Cómo repartir entre `{{ ... }}` y fórmulas `=...` de celda. La frontera render-time / open-time de ADR-0043. |
| 17 | [Vista durante la autoría de plantillas](./17-template-authoring-display.md) | Cómo se ve la plantilla en Excel mientras la editas (errores, marcadores), por qué es intencional, y el patrón `IFERROR` para dashboards. |
| 18 | [`@group` y `@subtotal`](./18-group-and-subtotal.md) | Intercalar filas de subtotal por grupo dentro de un único bloque de datos (ADR-0038) — un nivel, anidado y total general a partir del `@subtotal` más externo. |

## Cómo leer una receta

Cada receta sigue la misma estructura:

1. **Escenario** — el resultado que quiere el operador, en una frase.
2. **`__config__`** — claves necesarias.
3. **Celdas de plantilla** — el conjunto mínimo de celdas para producir el resultado.
4. **Datos** — una tabla de entrada pequeña.
5. **Resultado** — lo que devuelve `convert()`.
6. **Notas** — detalles a tener en cuenta y referencias a la especificación para profundizar.

## Convenciones de notación

- Las celdas se anotan con la notación A1 de Excel, no con `[row, col]`.
- Los valores de `__config__` aparecen de forma compacta como `clave = valor`, pero en el `template.xlsx` real se escriben en dos columnas (`A: clave`, `B: valor`).
- Los datos de origen se muestran como tablas Markdown para que las recetas queden cortas. En un `data.xlsx` real, esas filas viven en una hoja con el mismo nombre que `source_sheet`.

## Ejecutar las recetas

Las recetas de esta guía son fundamentalmente documentación — no todas vienen con un par `.xlsx` ejecutable. Para probarlas tú mismo:

1. Abre Excel y crea un nuevo archivo.
2. Añade una hoja `__config__` con las claves que indica la receta.
3. Añade una hoja de datos con el mismo nombre que `source_sheet`.
4. Añade una hoja de plantilla con las celdas de la receta.
5. Guarda como `template.xlsx` y los datos como `data.xlsx`.
6. Ejecuta `convert(templateBuffer, dataBuffer)` (consulta el [README](/readme#usage)).

Otra opción más rápida: copia uno de los [ejemplos ejecutables](https://github.com/jinyoung4478/xl3/tree/main/examples/) y adáptalo a tu gusto.
