---
sidebar_label: '10 · Estilos y marca'
pagination_label: '10 · Estilos y marca'
---

# 10 · Estilos y marca

## Escenario

Los libros de salida deben respetar la marca de tu empresa — colores de pestaña, tipografías, formatos numéricos, filas de título combinadas.

## Aplica los estilos directamente en la plantilla

xl3 conserva todos los estilos de la plantilla. El bloque de datos expande filas, pero cada fila renderizada hereda la tipografía, el relleno, los bordes, el formato numérico, la alineación, etc. de la fila de plantilla con estilo. Las filas de pie por debajo del bloque mantienen su estilo y se desplazan hacia abajo a medida que el bloque se expande.

No existe una directiva "estilo" — el estilo de Excel vive en el propio `.xlsx` de plantilla.

## `tabColor` de la hoja

Configura el color de la pestaña en Excel (clic derecho en la pestaña → `Color de pestaña`). xl3 lo conserva tal cual según ADR-0032 #3. Las hojas de salida mantienen el color de pestaña de la plantilla.

## Formatos numéricos y `TEXT()`

Dos formas de controlar cómo se muestra un número:

**1. `numFmt` en la celda de plantilla.** Configura la celda de plantilla con un formato como `#,##0.00` o `[$€-es-ES]#,##0`. La celda de salida formateada lleva el mismo formato.

**2. `TEXT()` en la expresión.** Fuerza una celda de tipo cadena con el formato exacto que quieres:

```text
{{ TEXT([Importe], "€#,##0.00") }}
{{ TEXT([Fecha], "yyyy-mm-dd") }}
{{ TEXT([Pct], "0.0%") }}
```

Usa `TEXT()` cuando necesites la cadena formateada dentro de una concatenación: `{{ "Total: " & TEXT(SUM([Importe]), "€#,##0") }}`.

Los formatos de `TEXT()` admitidos siguen la tabla básica de formatos de Excel. Los formatos fuera de la tabla básica son comportamiento definido por la implementación según ADR-0021.

## Celdas combinadas

xl3 preserva las combinaciones de la plantilla:

- Las combinaciones **encima** del bloque de datos permanecen donde están.
- Las combinaciones **debajo** del bloque de datos se desplazan hacia abajo a medida que el bloque se expande.
- Las combinaciones **dentro** del bloque de datos (a lo ancho de una fila de plantilla) se conservan en cada fila renderizada.

Las combinaciones verticales que cruzan el límite del bloque de datos son comportamiento definido por la implementación según ADR-0021 — evítalas en plantillas portables.

## Cabeceras en celdas combinadas: soporte nativo

Las plantillas de proveedores (Albarán, Orden de compra, Hoja de liquidación) suelen combinar celdas de cabecera a lo ancho de varias columnas para etiquetar un grupo de campos con un único título. xl3 las lee de forma nativa desde 0.5.0 (según ADR-0033): una cabecera combinada horizontalmente forma **una** columna lógica en la celda maestra de la combinación, y las celdas esclavas de la misma fila son transparentes.

Ejemplo: una fila de cabecera con `B1:D1 = "Producto"` (combinada en 3 columnas) y `E1 = "Cantidad"` se lee como dos columnas de origen: `Producto` y `Cantidad`. Los datos de `Producto` se leen desde la columna B; las columnas C y D se omiten porque sus celdas son esclavas de la combinación de B.

Los rangos de cabecera multifila (combinaciones 2D que cruzan filas y columnas) también funcionan — apunta `source_table` a la **última** fila del rango para que los datos empiecen justo debajo. Para un rango `J11:M12`, usa `source_table = J12:N` (no `J11:N`, que trataría la fila 12 como una fila de datos fantasma arrastrando el texto de la celda maestra).

Si el origen tiene de verdad dos columnas con el mismo nombre (no por una combinación), `xl3/source/duplicate-name` sigue saltando. La reducción solo aplica a celdas esclavas de combinaciones.

## Configuración de impresión

`pageSetup` (orientación, márgenes, área de impresión), `views` (zoom, paneles inmovilizados) y `defaultRowHeight` se conservan según ADR-0032 #3. Configúralos en la plantilla y se trasladan al resultado.

## Notas

- Las propiedades del libro (temas, nombres definidos, áreas de impresión) se conservan literalmente. Configúralas una vez en la plantilla; cada salida las hereda.
- Referencia de especificación: ADR-0032 "Niche limits and workbook pass-through behaviors"; [`spec/evaluation.md`](/es/spec/evaluation) "Cell Evaluation" para los estilos a nivel de celda.
