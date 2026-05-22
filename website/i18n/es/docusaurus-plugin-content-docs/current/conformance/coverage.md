# Matriz de cobertura de ADR

Generado automáticamente por `src/__tests__/spec-coverage.test.ts`. No editar manualmente.

| ADR | Título | Fixtures que lo cubren |
|---|---|---|
| 0001 | ADR 0001 — `TODAY()` retorna fecha UTC | `23-today-utc-dynamic` |
| 0002 | ADR 0002 — Reglas de sanitización del nombre de archivo de salida | `6-filename-forbidden-chars`, `7-filename-reserved-name` |
| 0003 | ADR 0003 — La coerción numFmt para celdas de expresión única es **MUST** | `10-numfmt-text-format-coercion`, `8-numfmt-numeric-string-coercion`, `9-numfmt-date-string-coercion` |
| 0004 | Auditoría de acoplamiento de la implementación de referencia | _(informativo)_ |
| 0005 | Aserciones de conformidad dinámicas | `23-today-utc-dynamic` |
| 0006 | Comparación de conformidad OOXML de etapa 2 | `24-stage2-merge-preservation`, `25-stage2-style-numfmt-preservation`, `26-stage2-splice-merge-style-preservation`, `27-stage2-cross-writer-canonicalization`, `93-stage2-excel-authored-expected` |
| 0007 | Definición de valor vacío | `50-empty-ifempty-whitespace-only`, `51-empty-ifempty-zero-not-empty`, `52-empty-count-field-whitespace-zero-false`, `53-empty-row-skip-whitespace-only`, `54-empty-list-membership`, `95-empty-fefff-not-whitespace` |
| 0008 | Reglas de truthiness para `IF()` y `@filter` | `55-if-truthy-zero-and-empty`, `56-if-truthy-string-zero-not-special`, `57-if-truthy-boolean`, `58-if-comparison-result` |
| 0009 | Operadores de comparación y coerción a string para `&` | `58-if-comparison-result`, `59-compare-numeric-string-vs-number`, `60-compare-string-codepoint-order`, `61-concat-canonical-form`, `62-concat-empty-stringifies-to-empty`, `63-compare-empty-vs-value`, `64-compare-unicode-minus-not-numeric`, `96-canonical-number-scientific-boundary` |
| 0010 | Entradas de usuario en tiempo de ejecución | `131-inputs-with-xtl-default`, `65-input-text-default-applied`, `66-input-text-host-supplied`, `67-input-missing-required-error`, `68-input-select-host-supplied` |
| 0011 | Nombres de hoja reservados y referencia unificada | `131-inputs-with-xtl-default`, `94-reserved-sheet-name-error` |
| 0012 | Modelo de datos multi-fuente | `69-source-multi-declaration`, `70-source-aggregate-cross-source`, `71-source-directive-active`, `72-source-undeclared-error`, `73-source-row-cross-error`, `91-source-unknown-column-error`, `92-composed-multi-source-join-filter-sort` |
| 0013 | Búsqueda cross-source con XLOOKUP | `74-xlookup-basic`, `75-xlookup-fallback`, `76-xlookup-no-match-error`, `77-xlookup-source-mismatch-error`, `78-xlookup-bare-bracket-error` |
| 0014 | Joins de fuentes vía `@join` | `79-join-basic-inner`, `80-join-no-match-dropped`, `81-join-undeclared-source-error`, `82-join-bad-on-clause-error` |
| 0015 | Reporte de errores estructurado + dirección i18n | `17`, `18`, `19`, `20`, `21`, `22`, `32`, `33`, `34`, `37`, `42`, `67`, `72`, `73`, `76`, `77`, `78`, `81`, `82`, `91` |
| 0016 | Orden y estabilidad | `83-sort-stable-equal-keys`, `84-sort-multi-stable-priority`, `85-file-group-first-seen-order`, `86-sheet-group-first-seen-order` |
| 0017 | Modelo de valor de fuente | `87-date-canonical-string-concat`, `88-date-comparison-equality`, `89-error-sentinel-empty`, `90-percentage-numeric-flow` |
| 0018 | reservado (placeholder de hueco) | _(informativo)_ |
| 0019 | Diferido: funciones de aritmética de fechas | `126-date-arithmetic-functions` |
| 0020 | Diferido: collation con consciencia de locale | _(informativo)_ |
| 0021 | Fronteras definidas por la implementación | `97-native-formula-static-cell-preserved`, `99-empty-template-block-error` |
| 0022 | Compatibilidad de versiones de Excel | _(informativo)_ |
| 0023 | Coerción de operadores + principio de Excel-por-defecto | `100-arithmetic-string-coerces-to-number`, `101-arithmetic-non-numeric-string-error` |
| 0024 | La aridad de funciones es parte de la especificación | `102-function-arity-round-missing-arg`, `103-function-arity-xlookup-too-few-args` |
| 0025 | La división por cero produce una celda de error #DIV/0! de Excel | `106-division-by-zero-produces-error-cell` |
| 0026 | Ciclo de vida de valores vacíos al renderizar celdas y claves de grupo | `107-group-key-empty-blank-placeholder-file`, `108-group-key-empty-blank-placeholder-sheet` |
| 0027 | Nombres de columna reservados + validación de args de directiva | `109-source-column-reserved-name-error`, `110-directive-empty-filter-error`, `111-directive-empty-source-error` |
| 0028 | Restricciones de sintaxis literal + detección de sintaxis no soportada | `112-literal-signed-number`, `113-unsupported-unary-on-column-ref-error` |
| 0029 | Composición de directivas + semántica de bordes de fuente | `114-duplicate-source-directive-error`, `115-self-join-error`, `116-function-name-case-insensitive`, `117-hidden-source-rows-included` |
| 0030 | Normalización Unicode en comparación de strings | `118-unicode-normalization-not-applied` |
| 0031 | La colisión del nombre de archivo de salida es un error | `119-output-filename-collision-error` |
| 0032 | Límites nicho y comportamientos de paso-a-través del libro | `120-workbook-properties-preserved` |
| 0033 | Encabezados combinados de source-table | `121-source-merged-header`, `124-source-2d-merge-header` |
| 0034 | Relación con motores de plantilla previos | _(informativo)_ |
| 0035 | Semántica de celdas combinadas en fila de datos | `122-source-data-row-merge-broadcast` |
| 0036 | Matriz de preservación de características de plantilla | `123-feature-preservation` |
| 0037 | Rechazado: inserción dinámica de imágenes | _(informativo)_ |
| 0038 | Directivas `@group` y `@subtotal` | `132-group-single-level-subtotal`, `133-group-two-level-nested-subtotal`, `134-group-grand-total-via-outermost-subtotal`, `135-group-filter-composition`, `136-group-missing-key`, `137-subtotal-outside-group`, `138-subtotal-bad-aggregate` |
| 0039 | Función HYPERLINK() | `125-hyperlink-function` |
| 0040 | Enmienda a la matriz de preservación: extensión de rango CF / DV + nivel de outline | _(informativo)_ |
| 0041 | Texto de celda multilínea | `127-multiline-cell-text` |
| 0042 | Rechazado: mutación de celda en tiempo de ejecución (estilo `jx:updateCell`) | _(informativo)_ |
| 0043 | Principio de preferencia Excel-nativa | _(informativo)_ |
| 0044 | Batch de funciones — aceptado según ADR-0043 | `128-function-batch-0044` |
| 0045 | Batch de funciones — rechazado según ADR-0043 | _(informativo)_ |
| 0046 | Contrato de preservación de fórmula de celda | `129-cell-formula-preservation` |
| 0047 | `ISBLANK` como alias predicado de `IFEMPTY` | `130-isblank-function` |
| 0048 | Relación con JXLS — frontera final y refinamiento de inconveniencia | _(informativo)_ |
| 0049 | Vista de autoría de plantilla vs. salida renderizada: asimetría intencional | _(informativo)_ |
| 0050 | ADR 0050 — Las entradas de plantilla aceptan expresiones XTL en `default` / `label` / `description` | `131-inputs-with-xtl-default`, `139-inputs-forward-reference`, `140-inputs-runtime-only-fn` |
| 0051 | ADR 0051 — Literales string y frontera del delimitador de bloque de plantilla | _(informativo)_ |
| 0052 | ADR 0052 — Clasificación de expresiones de celda: única vs texto mixto | _(informativo)_ |
| 0053 | ADR 0053 — Propagación de centinelas de error de Excel en texto mixto | _(informativo)_ |
| 0054 | ADR 0054 — Nombre desnudo en contexto de celda | _(informativo)_ |
| 0055 | ADR 0055 — Argumentos enteros de directiva: límites de enteros positivos | _(informativo)_ |
| 0056 | ADR 0056 — Lectura de claves de sistema de hoja reservada | _(informativo)_ |
| 0057 | ADR 0057 — `__lists__[name]` fuera de `@filter in` / `!in` | _(informativo)_ |
| 0058 | ADR 0058 — Composición de fila `@subtotal`: enlace de nivel en misma fila | _(informativo)_ |
| 0059 | ADR 0059 — Forma de argumento de función agregada | _(informativo)_ |
| 0060 | ADR 0060 — Reglas cross-source del argumento de valor de `XLOOKUP` | _(informativo)_ |
| 0061 | ADR 0061 — Desambiguación léxica de nombres de fuente | _(informativo)_ |
| 0062 | ADR 0062 — Semántica de `default = ""` en `__inputs__` | _(informativo)_ |
| 0063 | ADR 0063 — Reglas de pipe-split para `options` de `__inputs__` | _(informativo)_ |
| 0064 | ADR 0064 — Coerción string-a-número: alcance de notación científica | _(informativo)_ |
| 0065 | ADR 0065 — Referencia explícita de `@source default` | _(informativo)_ |
