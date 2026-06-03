# Suite de conformidad de XTL

Este directorio contiene el **corpus de conformidad** — los fixtures de prueba que cualquier implementación de XTL debe pasar para reclamar conformidad. El corpus es la definición ejecutable del comportamiento de XTL.

## Organización

```
conformance/
├── README.md            ← este archivo
├── AUTHORING.md         ← cómo añadir fixtures (evitar la trampa de "JS como verdad")
├── runner-protocol.md   ← cómo las implementaciones deben ejecutar la suite
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← salida esperada canónica (caso de archivo único)
        ├── expected/            ← O un directorio de archivos (caso multi-archivo o sin salida)
        │   └── *.xlsx
        ├── sin salida esperada  ← para fixtures expected_error
        ├── sin expected estático ← para fixtures expected_dynamic
        └── meta.yaml            ← descripción, referencias a secciones de la especificación, tags
```

## Qué significa "pasar"

Un fixture de salida estática pasa si la implementación, dados `template.xlsx` y
`data.xlsx`, produce salidas que coinciden con `expected.xlsx` (o con el contenido de
`expected/`). Los ejecutores de etapa 1 pueden comparar valores de hoja/celda de alto nivel.
Los ejecutores de etapa 2 comparan contenido del libro byte a byte tras una **normalización
canónica** del zip OOXML:

- Archivos dentro del zip ordenados por nombre
- XML serializado en forma canónica determinista
- Espacios en blanco dentro de runs de texto preservados
- Metadatos del generador eliminados (creator, modifiedBy, lastModified)

Consulta [`runner-protocol.md`](/es/conformance/runner-protocol) para la etapa de comparación y
las reglas de canonicalización.

Un fixture de error pasa cuando la implementación reporta un error que contiene el
texto de `expected_error` del fixture. Los fixtures de error no incluyen `expected.xlsx`
ni un directorio `expected/`.

Un fixture dinámico pasa cuando la salida de la implementación coincide con las
aserciones dinámicas declaradas por `expected_dynamic` en `meta.yaml`. Los fixtures
dinámicos no incluyen `expected.xlsx` ni un directorio `expected/`.

## Versionado

Cada directorio de fixture contiene `meta.yaml` declarando la versión mínima de la especificación que requiere (`spec_version: 0.1`). Las implementaciones reportan a qué versión de la especificación apuntan; la suite filtra los fixtures en consecuencia.

Los fixtures de salida estática también pueden declarar `comparison_stage`. El campo
toma por defecto `1`; los fixtures que requieren comparación canónica de OOXML declaran
`comparison_stage: 2`.

## Metadatos del fixture

Campos de `meta.yaml` usados por el corpus:

| Campo | Requerido | Aplica a | Significado |
|---|---:|---|---|
| `description` | sí | todos los fixtures | Contrato de una línea que el fixture asegura. |
| `spec_section` | sí | todos los fixtures | Sección de la especificación o ADR que define el comportamiento. |
| `spec_version` | sí | todos los fixtures | Versión mínima de XTL requerida por el fixture. |
| `tags` | sí | todos los fixtures | Categorías filtrables para reportes y ejecuciones enfocadas. |
| `verified_by` | no | todos los fixtures | Verificaciones de autoría independientes, como `hand` o `manual-script`. |
| `expected_warnings` | no | todos los fixtures | Substrings estables de advertencia que la implementación debería emitir. |
| `expected_error` | no | fixtures de error | Substring estable de error; se omiten las salidas estáticas esperadas. |
| `expected_dynamic` | no | fixtures dinámicos | Tipo de aserción dinámica; actualmente `utc_today`. |
| `dynamic_cells` | con `expected_dynamic` | fixtures dinámicos | Aserciones de hoja/celda/formato calculadas por el ejecutor. |
| `comparison_stage` | no | fixtures de salida estática | Etapa de comparación mínima; toma por defecto `1`, usa `2` para verificaciones sensibles a OOXML. |
| `skip_reason` | no | todos los fixtures | Razón temporal por la que un fixture roto conocido se omite. |

`expected_error` y `expected_dynamic` son mutuamente exclusivos. Los fixtures de
salida estática usan `expected.xlsx` o `expected/`; un directorio `expected/` vacío
significa cero archivos de salida. Los fixtures de error y dinámicos omiten las
salidas estáticas esperadas.

## Catálogo de fixtures

El corpus de arranque de XTL 0.1 contiene actualmente estos fixtures:

| ID | Fixture | Contrato |
|---|---|---|
| 001 | `bracket-substitution` | Expresiones de columna fuente entre corchetes producen una fila de salida por fila de fuente. |
| 002 | `if-function` | `IF(condition, then, else)` evalúa comparaciones dentro de la fila de datos actual. |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` conserva las filas coincidentes y elimina la hoja de lista de la salida. |
| 004 | `repeat-right-default` | `@repeat right` sin un conteo explícito toma `colSpan = 1` por defecto. |
| 005 | `round-half-away-from-zero` | `ROUND()` usa redondeo estilo Excel (mitad alejándose de cero). |
| 006 | `filename-forbidden-chars` | Los caracteres prohibidos en nombres de archivo se reemplazan por `_`. |
| 007 | `filename-reserved-name` | Los nombres base de dispositivos reservados de Windows reciben un único `_` final. |
| 008 | `numfmt-numeric-string-coercion` | Los formatos numéricos de plantilla coaccionan strings numéricas a números. |
| 009 | `numfmt-date-string-coercion` | Los formatos de fecha de plantilla coaccionan strings con forma de fecha a valores de fecha. |
| 010 | `numfmt-text-format-coercion` | El formato de texto `@` coacciona un valor de expresión única a string. |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` retorna una string usando los tokens de fecha de XTL. |
| 012 | `text-number-format` | `TEXT(number, format)` admite el subconjunto mínimo de formato numérico de XTL 0.1. |
| 013 | `rich-text-template-expression` | Las celdas de plantilla con rich-text se parsean concatenando runs de texto antes de la detección de expresiones. |
| 014 | `source-formula-cached-result` | Las celdas con fórmula en la fuente usan resultados cacheados y no son recalculadas por XTL. |
| 015 | `source-sheet-prefix-first-match` | Los patrones de prefijo `source_sheet` seleccionan la primera hoja coincidente en el orden del libro. |
| 016 | `text-number-negative-rounding` | Los formatos numéricos `TEXT()` redondean los bordes de `.5` negativos mitad alejándose de cero. |
| 017 | `source-sheet-prefix-no-match-error` | Cuando no hay coincidencia para el prefijo `source_sheet`, se reporta un error estable. |
| 018 | `source-formula-missing-cached-result-error` | Las celdas con fórmula en la fuente sin resultado cacheado reportan un error estable. |
| 019 | `filename-empty-basename-error` | La sanitización de nombre de archivo reporta un error para un nombre base vacío. |
| 020 | `filename-length-overflow-error` | La sanitización de nombre de archivo reporta un error por encima del límite de 255 bytes. |
| 021 | `numfmt-number-coercion-error` | Los formatos numéricos de plantilla reportan un error cuando la coerción falla. |
| 022 | `numfmt-date-coercion-error` | Los formatos de fecha de plantilla reportan un error cuando la coerción falla. |
| 023 | `today-utc-dynamic` | `TODAY()` produce la fecha UTC de inicio del ejecutor mediante una aserción dinámica. |
| 024 | `stage2-merge-preservation` | La comparación de etapa 2 verifica que los rangos combinados debajo de bloques de datos expandidos se preservan. |
| 025 | `stage2-style-numfmt-preservation` | La comparación de etapa 2 verifica que las celdas renderizadas preservan el estilo y el numFmt de la plantilla. |
| 026 | `stage2-splice-merge-style-preservation` | La comparación de etapa 2 verifica que la expansión de filas preserva tanto los rangos combinados desplazados como las celdas renderizadas con estilo/formato numérico. |
| 027 | `stage2-cross-writer-canonicalization` | La comparación de etapa 2 verifica que las diferencias conocidas entre escritores OOXML canonicalizan al mismo contenido de libro. |
| 028 | `source-table-row-shorthand` | `source_table = N` selecciona la fila `N` como nombres de columna de fuente y lee las filas debajo. |
| 029 | `source-table-open-range` | `source_table = B3:D` selecciona una ventana de columnas y lee filas debajo hasta el final de filas usadas. |
| 030 | `source-table-finite-range` | `source_table = B3:D4` deja de leer al llegar a la fila final declarada. |
| 031 | `source-table-zero-data-range` | `source_table = B3:D3` es válido y produce cero filas de fuente. |
| 032 | `source-table-empty-column-name-error` | Los nombres de columna de fuente vacíos dentro del span seleccionado reportan un error estable. |
| 033 | `source-table-duplicate-column-name-error` | Los nombres de columna de fuente duplicados reportan un error estable. |
| 034 | `source-table-invalid-selector-error` | Los selectores inválidos, como fila cero, reportan un error estable. |
| 035 | `source-table-rich-text-header` | Las celdas de nombre de columna de fuente con rich-text se concatenan antes del parseo de `source_table`. |
| 036 | `source-table-formula-header` | Las celdas de nombre de columna de fuente con fórmula usan resultados cacheados. |
| 037 | `source-table-formula-header-missing-cache-error` | Las celdas de nombre de columna de fuente con fórmula sin resultado cacheado reportan un error estable. |
| 038 | `source-sheet-exact-match-beats-prefix` | Las coincidencias exactas de `source_sheet` tienen precedencia sobre los patrones de prefijo. |
| 039 | `source-sheet-default-first-worksheet` | Si se omite `source_sheet`, se usa la primera hoja en el orden del libro. |
| 040 | `list-sheet-hidden-states-removed` | Las hojas de lista ocultas y muy ocultas se eliminan igualmente de los libros de salida. |
| 041 | `row-function-inside-repeat-block` | `ROW()` retorna el índice 1-based de la fila de datos renderizada dentro de un bloque repeat. |
| 042 | `row-function-outside-repeat-block-error` | Llamar a `ROW()` fuera de un bloque repeat reporta un error estable. |
| 043 | `ifempty-function` | `IFEMPTY()` retorna el fallback para valores vacíos y deja pasar los valores no vacíos. |
| 044 | `sort-and-top-order` | `@sort` se ejecuta antes de `@top`, por lo que las N filas superiores vienen del conjunto ya ordenado. |
| 045 | `list-sheet-not-in-filter` | `@filter ... !in _Sheet` conserva las filas cuyos valores no están en la hoja de lista y elimina la hoja de lista de la salida. |
| 046 | `count-field-non-empty` | `COUNT([field])` cuenta valores no vacíos en el conjunto de filas actual. |
| 047 | `aggregate-functions` | Los agregados principales operan sobre el conjunto de filas renderizadas actual. |
| 048 | `if-and-comparison-boundaries` | Los operadores de comparación dirigen el comportamiento de `IF()` y `@filter` alrededor del borde de cero. |
| 049 | `filename-sanitization-warning` | Sanitizar un nombre de archivo renderizado emite una advertencia sin cambiar la semántica de salida. |
| 050 | `empty-ifempty-whitespace-only` | IFEMPTY trata las strings que solo contienen espacios como vacías según ADR-0007. |
| 051 | `empty-ifempty-zero-not-empty` | IFEMPTY preserva el número 0; los números nunca son vacíos según ADR-0007. |
| 052 | `empty-count-field-whitespace-zero-false` | COUNT([field]) cuenta valores no vacíos según ADR-0007 — espacios vacíos, 0 y FALSE no vacíos. |
| 053 | `empty-row-skip-whitespace-only` | Una fila fuente cuyas celdas sean todas vacías según ADR-0007 se omite, incluidas las celdas con solo espacios. |
| 054 | `empty-list-membership` | Las hojas de lista descartan las entradas vacías al leerse; un valor de fila fuente vacío nunca coincide con `@filter ... in _Sheet` según ADR-0007. |
| 055 | `if-truthy-zero-and-empty` | IF trata 0 y los valores vacíos como falsy; números distintos de cero, strings no vacías y TRUE son truthy según ADR-0008. |
| 056 | `if-truthy-string-zero-not-special` | `IF("0", …)` e `IF("false", …)` toman la rama truthy — no hay caso especial para valores de bandera tipados como string. |
| 057 | `if-truthy-boolean` | Una celda fuente booleana dirige la truthiness de IF directamente según ADR-0008. |
| 058 | `if-comparison-result` | El resultado booleano de una expresión de comparación alimenta directamente la truthiness de IF según ADR-0008. |
| 059 | `compare-numeric-string-vs-number` | La comparación parsea números y strings numéricas bajo el `compareValues` compartido según ADR-0009. |
| 060 | `compare-string-codepoint-order` | La comparación fallback de strings usa orden de code-point Unicode — sin collation con consciencia de locale según ADR-0009. |
| 061 | `concat-canonical-form` | `&` convierte operandos a string usando la forma canónica de string según ADR-0009 (booleanos en mayúsculas, enteros sin decimales). |
| 062 | `concat-empty-stringifies-to-empty` | `&` sobre un operando vacío aporta la string vacía según ADR-0009. |
| 063 | `compare-empty-vs-value` | Dos operandos vacíos se comparan iguales; exactamente un vacío hace que `=` sea falso según las reglas 1 y 2 de ADR-0009. |
| 064 | `compare-unicode-minus-not-numeric` | Una string con menos Unicode (U+2212) no se parsea como número; la comparación cae al fallback de string canónica según ADR-0009. |
| 065 | `input-text-default-applied` | Un valor por defecto de input de texto `_inputs` se rellena cuando el host omite el valor (ADR-0010). |
| 066 | `input-text-host-supplied` | Un input provisto por el host fluye a través de celdas, nombres de hoja y el patrón de nombre de archivo de salida (ADR-0010). |
| 067 | `input-missing-required-error` | Una declaración `_inputs` requerida (sin default) que el host omite es un error (ADR-0010). |
| 068 | `input-select-host-supplied` | Un input `select` acepta un valor del host listado en las opciones declaradas separadas por pipes (ADR-0010). |
| 069 | `source-multi-declaration` | Una hoja `__sources__` declara una fuente nombrada adicional; los agregados sobre ella operan sobre su conjunto completo de filas según ADR-0012. |
| 070 | `source-aggregate-cross-source` | COUNT/MIN/MAX sobre una fuente nombrada operan sobre su conjunto completo de filas según ADR-0012. |
| 071 | `source-directive-active` | `@source SourceName` delimita el alcance de un bloque de datos; dentro de él, `[Column]` se resuelve a esa fuente según ADR-0012. |
| 072 | `source-undeclared-error` | `@source` referenciando una fuente no declarada en `__sources__` es un error en tiempo de parseo según ADR-0012. |
| 073 | `source-row-cross-error` | Una referencia a nivel de fila a la columna de una fuente no activa es un error según ADR-0012. |
| 074 | `xlookup-basic` | XLOOKUP de 3 args retorna la columna del return-array coincidente para la primera fila cuyo lookup-array coincide según ADR-0013. |
| 075 | `xlookup-fallback` | XLOOKUP de 4 args retorna el fallback cuando ninguna fila coincide según ADR-0013. |
| 076 | `xlookup-no-match-error` | XLOOKUP de 3 args sin fallback da error cuando ninguna fila coincide según ADR-0013. |
| 077 | `xlookup-source-mismatch-error` | El arg 2 y el arg 3 de XLOOKUP deben referenciar la misma fuente según ADR-0013. |
| 078 | `xlookup-bare-bracket-error` | El arg 2 / arg 3 de XLOOKUP requieren una referencia entre corchetes con prefijo de fuente según ADR-0013. |
| 079 | `join-basic-inner` | `@join` empareja cada fila primaria con la primera fila unida coincidente según ADR-0014. |
| 080 | `join-no-match-dropped` | `@join` usa semántica de inner — las filas primarias sin coincidencia se descartan según ADR-0014. |
| 081 | `join-undeclared-source-error` | `@join` referenciando una fuente no declarada en `__sources__` es un error en tiempo de parseo según ADR-0014. |
| 082 | `join-bad-on-clause-error` | La cláusula on de `@join` debe referenciar la fuente unida y la fuente primaria del bloque según ADR-0014. |
| 083 | `sort-stable-equal-keys` | `@sort` es estable — las filas con claves iguales preservan el orden de fuente según ADR-0016. |
| 084 | `sort-multi-stable-priority` | Múltiples directivas `@sort` se aplican con primera = clave primaria, las posteriores como criterios de desempate según ADR-0016. |
| 085 | `file-group-first-seen-order` | Los grupos de archivo se emiten en orden de primera aparición sobre las filas fuente según ADR-0016. |
| 086 | `sheet-group-first-seen-order` | Los grupos de hoja dentro de un archivo se emiten en orden de primera aparición según ADR-0016. |
| 087 | `date-canonical-string-concat` | Una Date dentro de `&` produce YYYY-MM-DD (medianoche) o YYYY-MM-DDTHH:mm:ss según ADR-0017. |
| 088 | `date-comparison-equality` | Los valores de fecha se comparan vía forma canónica de string contra un valor de filtro string según ADR-0017. |
| 089 | `error-sentinel-empty` | Las celdas de error de Excel (`#N/A`, `#VALUE!`, …) se leen como vacías según ADR-0017. |
| 090 | `percentage-numeric-flow` | Las celdas con formato de porcentaje fluyen como su Number subyacente según ADR-0017 (50% → 0.5). |

## Estado

El corpus de XTL 0.1 está en **estado de arranque**. Los fixtures deberían añadirse solo para comportamientos ya enunciados en [`spec/README.md`](/es/spec), siguiendo el mismo patrón usado por proyectos de estándares como CommonMark: la prosa define la regla, los fixtures hacen la regla ejecutable, y las implementaciones reportan qué fixtures pasan.

La implementación de referencia no hace su propio comportamiento normativo. Cuando un fixture y la implementación discrepan, actualiza la implementación o el fixture según la precedencia de especificación en [`spec/README.md`](/es/spec).

Los fixtures del comportamiento principal de XTL 0.1 evitan extensiones definidas por la implementación, como formatos de `TEXT()` fuera de la tabla mínima en [`spec/language.md`](/es/spec/language).
