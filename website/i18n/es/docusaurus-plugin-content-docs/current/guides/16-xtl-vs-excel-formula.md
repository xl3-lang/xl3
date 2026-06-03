---
sidebar_label: '16 · Funciones XTL vs. fórmulas de Excel'
pagination_label: '16 · Funciones XTL vs. fórmulas de Excel'
---

# 16 · Funciones XTL vs. fórmulas de Excel

## Trampas habituales — empieza aquí

Probablemente has llegado aquí porque algo no funcionó como esperabas. Los casos más probables:

### "Quiero ver `€1.234.567` en una celda, pero `TEXT([Importe], "€#,##0")` no funciona"

El conjunto de tokens de formato de `TEXT()` en XTL es pequeño a propósito; los tokens de moneda no están incluidos. La respuesta correcta es el **formato numérico de la celda**:

| Paso | Dónde |
|---|---|
| 1. En la celda de plantilla, configura el formato como `"€"#,##0` | Excel: Formato de celdas → Personalizado |
| 2. Pon `{{ [Importe] }}` (solo el número) en esa celda | Sustitución XTL |

La celda renderizada contiene el número y Excel lo muestra como `€1.234.567`. Ordenar, filtrar y las fórmulas posteriores siguen funcionando porque el valor sigue siendo un número.

El mismo patrón sirve para negativos contables `(1.234)` (`#,##0;(#,##0)`), porcentajes (`0,00%`) y fechas (`yyyy-mm-dd`).

### "Quiero que `=B2*2` se calcule por fila, pero todas las filas muestran el mismo valor"

xl3 conserva el texto de la fórmula tal cual a través de la expansión de filas de `@repeat` — **no** reescribe `B2` a `B3`, `B4`, etc. (Véase el contrato en ADR-0046.)

Usa una expresión XTL en su lugar:

```text
{{ [Importe] * 2 }}
```

Esto se evalúa por fila en tiempo de render y escribe el número calculado en cada celda. Mismo resultado, sin confusión de referencias de fila.

### "Quiero un total al final; `=SUM(B2:B5)` no se extiende cuando se multiplican las filas"

Misma raíz — xl3 no reescribe referencias de rango. Dos opciones:

- **Referencia a columna entera** en el pie: `=SUM(B:B)` (o usa un `@filter` previo para dejar solo filas de datos).
- **Agregado XTL**: pon `{{ SUM([Importe]) }}` en la celda del pie. Se calcula en tiempo de render y se escribe el número.

### "Quiero un enlace clicable por fila"

Usa la función XTL `HYPERLINK()` (URL/etiqueta pueden referenciar columnas):

```text
{{ HYPERLINK([Url], [Etiqueta]) }}
```

Para URLs estáticas, también funciona una fórmula `=HYPERLINK("https://...", "etiqueta")` directamente en la celda (xl3 la conserva).

### "Quiero `IF(...)` con cinco ramas; el anidamiento es ilegible"

`IFS(c1, v1, c2, v2, ...)` es la función XTL para condicionales de múltiples ramas. Termina con `TRUE, default` como respaldo:

```text
{{ IFS([R] > 10000, "VIP", [R] > 1000, "Estandar", TRUE, "Basico") }}
```

### "Quiero `SUM(Cantidad * Precio)` como `SUMPRODUCT` o una fórmula matricial"

Los agregados XTL no aceptan aritmética por fila dentro del argumento. `{{ SUM([Cantidad] * [Precio]) }}`, `{{ SUM([A] + [B]) }}`, `{{ AVERAGE([Ventas] - [Coste]) }}` y formas similares lanzan `xl3/eval/bad-aggregate-arg` en tiempo de parsing (ADR-0059). El argumento debe ser una sola referencia de columna: `[Column]` o `Source[Column]`.

Tres opciones, en orden de preferencia:

1. **Columna auxiliar en el origen** — añade una columna `Importe` al origen (calculada o premultiplicada) y luego `{{ SUM([Importe]) }}`. Es el patrón canónico de XTL para "suma de A × B".
2. **`SUMPRODUCT` nativo de Excel en la celda del pie** — xl3 conserva las fórmulas de celda tal cual (ADR-0046). Escribe `=SUMPRODUCT(E2:E10000, F2:F10000)` directamente en la celda del pie. Usa rangos sobredimensionados (`E2:E10000`) porque no se conoce el número de filas renderizadas en tiempo de autoría. Atención a las dos trampas del pie (referencia a la propia columna; doble conteo por sobredimensionado) — véase [Guía LLM § Footer pitfalls](https://github.com/jinyoung4478/xl3/blob/main/docs/llm-template-authoring.md#footer-pitfall-1--self-column-sum-raises-순환-참조-circular-reference).
3. **Celda XTL por fila + columna auxiliar en la salida renderizada** — pon `{{ [Cantidad] * [Precio] }}` en una celda por fila (esto funciona; es un contexto no agregado) y suma en el pie con `{{ SUM([ColumnaAuxiliar]) }}` solo si `ColumnaAuxiliar` también es una columna del origen. Si no, vuelves a la opción 1 o 2.

Por qué la restricción: XTL 0.x mantiene la superficie de funciones pequeña y predecible. La agregación con cómputo por fila (comportamiento de fórmula matricial de Excel) es una funcionalidad aplazada — véase ADR-0059 § "Why not allow `SUM([a] + [b])`".

### "Busco `SUMIF` / `COUNTIF` / `AVERAGEIF`"

No vayas a por la función — usa el patrón de bloque de datos. Para "sumar importes donde el estado es VIP":

```text
{{ @filter [Estado] = "VIP" }}
{{ @repeat down }}
... plantilla de fila de datos ...
{{ SUM([Importe]) }}
```

Si necesitas mostrar tanto el total filtrado COMO las filas sin filtrar, pon `=SUMIF(B:B, "VIP", C:C)` directamente en la celda — xl3 mantiene la fórmula y Excel la evalúa al abrir.

### "Quiero `ISBLANK(x)`"

Existe desde 0.5.x (ADR-0047). Devuelve `true` cuando el valor está vacío según ADR-0007 — incluidas las cadenas con solo espacios.

```text
{{ IF(ISBLANK([Nota]), "(ninguna)", [Nota]) }}
```

También puedes usar `IFEMPTY([Nota], "(ninguna)")` para la forma con respaldo. Ambas comprueban el mismo predicado.

---

## La regla general

> **Usa XTL `{{ ... }}` solo cuando el valor debe conocerse antes de escribir el libro. En el resto, pon la fórmula en la celda y deja que Excel la evalúe al abrir.**

La frontera es el tiempo de render:

- **Antes del render — solo XTL:** `@filter`, `@sort`, `@top`, `@group`, `@subtotal`, agregados sobre datos de origen (`SUM`, `COUNT`, …), `XLOOKUP` entre fuentes, `output_file_pattern`, `__sheet_name_pattern__`, valores por defecto de `__inputs__`. Excel no puede llegar a estos — no hay celda donde pueda evaluar.
- **Tras el render — Excel basta:** formato de visualización de celda, aritmética por celda sobre valores renderizados, transformaciones de cadenas sobre valores de salida, comprobaciones de tipo, extracción de componentes de fecha sobre celdas de salida.

El principio es normativo — ADR-0043 — y mantiene la superficie de funciones de XTL pequeña por construcción. Cada función de Excel que no está en la tabla de XTL queda de forma intencional en la ruta de fórmula de Excel.

---

## Cuadro comparativo

| Objetivo | Forma XTL | Forma con fórmula Excel | Recomendado |
|---|---|---|---|
| Mostrar un número como `1.234.567,00` | `{{ TEXT([A], "#,##0.00") }}` (cadena) | `numFmt = "#,##0.00"`, valor `{{ [A] }}` (número) | **Fórmula Excel** para lo visual; XTL si necesitas la cadena |
| Mostrar `€1.234.567` | (no soportado en XTL) | `numFmt = "€"#,##0` | **Fórmula Excel** |
| Mostrar negativos entre paréntesis | (no soportado) | `numFmt = #,##0;(#,##0)` | **Fórmula Excel** |
| Aritmética por fila (`*2`) | `{{ [A] * 2 }}` | `=B2*2` ❌ no se reescribe por fila | **XTL** |
| SUM en pie sobre rango expansivo | `{{ SUM([A]) }}` | `=SUM(B:B)` columna entera funciona | Cualquiera |
| Suma de A × B (SUMPRODUCT) | columna auxiliar en el origen + `{{ SUM([Importe]) }}` | `=SUMPRODUCT(E2:E10000, F2:F10000)` en la celda del pie | **Fórmula Excel** o columna auxiliar — `SUM([A]*[B])` lanza `xl3/eval/bad-aggregate-arg` |
| Hipervínculo estático | (innecesario) | `=HYPERLINK("...", "etiqueta")` | **Fórmula Excel** |
| Hipervínculo dinámico por fila | `{{ HYPERLINK([Url], [Etiqueta]) }}` | inviable (infierno de comillas) | **XTL** |
| Filtrar filas de "este mes" | `{{ @filter MONTH([Fecha]) = MONTH(TODAY()) }}` | (Excel no puede filtrar antes del render) | **Solo XTL** |
| Nombre de archivo "mes anterior" | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}.xlsx` | (no hay ruta de fórmula en el nombre de archivo) | **Solo XTL** |
| Etiqueta de categoría multi-rama | `{{ IFS([R]>10000, "VIP", [R]>1000, "Est", TRUE, "Basico") }}` | `=IFS(B2>10000, "VIP", ...)` | Cualquiera; XTL si filter/group dependen del valor |
| Agregado condicional | `@filter` + bloque `SUM` | `=SUMIF(B:B, "VIP", C:C)` | XTL para totales de bloque; fórmula Excel para cortes transversales |
| `MOD` / `INT` / `SQRT` / `POWER` | (no soportado en XTL) | Fórmula de celda | **Fórmula Excel** |
| Comprobación de vacío | `ISBLANK([X])` o `IFEMPTY([X], "fallback")` | `=ISBLANK(B2)` | Cualquiera; ISBLANK casa con el idioma Excel |
| Otros tests `IS*` | (no soportado) | `=ISNUMBER(B2)` etc. | **Fórmula Excel** |

---

## Árbol rápido de decisión

```
¿El valor influye en:
  • qué filas se renderizan?      → @filter / @sort       (XTL)
  • cómo se agrupan las filas?    → @group / @subtotal    (XTL)
  • el nombre del archivo?        → {{ ... }}             (XTL)
  • el nombre de la hoja?         → {{ ... }}             (XTL)
  • un default de __inputs__?     → {{ ... }}             (XTL)
  • un valor calculado por fila?  → {{ ... }}             (XTL)
  • cómo *se ve* una celda?       → numFmt de celda       (lado Excel)
  • una fórmula por fila?         → expresión {{ ... }}   (XTL)
  • un cálculo estático/columna?  → =FORMULA en la celda  (lado Excel)
```

---

## Por qué existe esta regla

La superficie de funciones de XTL se mantiene pequeña por construcción (ADR-0043) para que los porters tengan un catálogo claro que implementar. Añadir funciones solo para la salida de celdas duplica lo que Excel ya hace e infla la especificación.

El trade-off: un libro de salida de xl3 no es totalmente autocontenido cuando los autores usan fórmulas de celda — abrirlo depende del recálculo de Excel. Para la mayoría de informes operativos este es el flujo esperado.

Cuando te encuentres buscando una función que XTL no tiene:

1. **¿El valor se usa dentro de una directiva (`@filter`, `@sort`, `@top`, `@group`, `@subtotal`) o en `output_file_pattern` / `__sheet_name_pattern__`?** → Debe ser XTL. Si XTL no provee lo que necesitas, abre una issue con la plantilla "Function re-proposal" (ver GitHub issues).
2. **En caso contrario** → pon la fórmula de Excel directamente en la celda. xl3 la conserva; Excel la evalúa al abrir.

## Véase también

- [ADR-0043 — Excel-native preference principle](/es/spec/decisions/0043-excel-native-preference)
- [ADR-0044 — Function batch accepted](/es/spec/decisions/0044-function-batch-accepted)
- [ADR-0045 — Function batch rejected](/es/spec/decisions/0045-function-batch-rejected)
- [ADR-0046 — Cell formula preservation contract](/es/spec/decisions/0046-cell-formula-preservation)
- [ADR-0047 — ISBLANK as IFEMPTY alias](/es/spec/decisions/0047-isblank-as-ifempty-alias)
- [Receta 10 — Estilos y marca](./10-styling-and-branding.md) — cuándo `numFmt` es la respuesta correcta
- [Receta 11 — Formato con TEXT()](./11-text-formatting.md) — cuándo `TEXT()` *es* la respuesta correcta
- [Receta 12 — Valores vacíos en profundidad](./12-empty-values.md) — compañero de IFEMPTY / ISBLANK
