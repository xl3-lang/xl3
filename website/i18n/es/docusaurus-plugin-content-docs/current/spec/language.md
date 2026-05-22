# Lenguaje XTL

:::note
Esta traducción al español es una ayuda de lectura. La fuente canónica de la especificación es la [versión en inglés](https://xl3.io/spec/language); en caso de divergencia normativa, prevalece el inglés.
:::

Este documento define la superficie del lenguaje de plantillas XTL 0.1. La notación que aparece aquí es normativa para los autores de plantillas y para las implementaciones.

Una gramática formal para el contenido de los bloques de plantilla `{{ ... }}` vive en [`grammar.ebnf`](./grammar.ebnf) — material de apoyo no normativo para porteadores y herramientas. Las definiciones de términos viven en [`glossary.md`](./glossary.md).

## Bloques de plantilla

Las expresiones de plantilla se escriben dentro de dobles llaves:

```text
{{ expression }}
```

Los espacios en blanco inmediatamente dentro de `{{` y `}}` no son significativos — el parser recorta los espacios al principio y al final antes de normalizar. Los siguientes son equivalentes:

```text
{{ [name] }}
{{[name]}}
{{    [name]    }}
{{
  [name]
}}
```

Los espacios en blanco entre operadores (por ejemplo, `{{ [a] + [b] }}` frente a `{{ [a]+[b] }}`) tampoco son significativos. Los espacios en blanco dentro de literales de cadena se preservan (`"hello world"` mantiene su espacio).

Un bloque de plantilla cuyo contenido interno está vacío (`{{ }}` o solo espacios) es un error de análisis según ADR-0021 (`xl3/parser/empty-block`).

Un bloque de plantilla se abre con `{{` y se cierra con el **primer** `}}` siguiente en el orden del texto de la celda. El escáner de delimitadores NO es consciente de los literales de cadena: un `}}` dentro de un literal `"..."` CIERRA el bloque (ADR-0051). Los autores que necesiten un `}}` literal dentro de un valor lo guardan en `__config__[key]` y lo referencian mediante `{{ __config__[key] }}`. Un cuerpo de expresión cuyo número de `"` es impar (literal no balanceado, casi siempre causado por un delimitador embebido) lanza (**raises**) `xl3/parser/unbalanced-literal`.

## Columnas de fuente

Las columnas de fuente se referencian con la sintaxis de corchetes:

```text
{{ [Customer] }}
{{ [Customer Name] }}
{{ [Units Per Case] }}
```

El texto dentro de `[` y `]` es el nombre exacto de la columna de la fuente tras recortar los espacios en blanco que la rodean. Los nombres de columna pueden (**MAY**) contener espacios, letras, números y signos de puntuación excepto `]` y saltos de línea.

Los nombres simples como `{{ Customer }}` no son referencias a columnas de la fuente en las celdas. Los nombres simples están reservados para claves de grupo de hoja y de archivo.

Según ADR-0054, un identificador simple dentro de un bloque de plantilla se resuelve en este orden, levantando `xl3/expression/unknown-name` si la búsqueda no encuentra resultado:

| Contexto | Orden de resolución |
|---|---|
| `output_file_pattern` | clave del grupo de archivos → `__inputs__[name]` → `__config__[name]` |
| Patrón de nombre de hoja | clave del grupo de hoja → `__inputs__[name]` → `__config__[name]` |
| Celda de datos | clave del grupo de archivos contenedor → clave del grupo de hoja contenedor → `__inputs__[name]` → `__config__[name]` (los literales booleanos `TRUE`/`FALSE` siguen resolviéndose como literal antes de esta cadena) |

Los identificadores simples en las celdas de datos NO se resuelven a columnas de la fuente; los autores deben (**MUST**) usar la forma explícita `[Column]` para las referencias a columnas. La cadena de resolución abreviada en celdas de datos existe para que `{{ Region }}` dentro de una hoja cuyo `output_file_pattern` es `{{ [Region] }}.xlsx` lea el valor del grupo activo como se espera.

## Literales

XTL 0.1 admite:

```text
"text"
123
123.45
-123
```

### Literales de cadena (según ADR-0028)

Un par balanceado delimitado por `"`. **Sin secuencias de escape** — las barras invertidas pasan literalmente; no hay una forma normativa de incrustar un `"` dentro de un literal de cadena en 0.x. Los autores que necesiten un `"` en un valor lo guardan en una clave de autor de `__config__` (el contenido de la celda puede ser cualquier carácter) y lo referencian mediante `{{ __config__[key] }}`.

Una comilla no balanceada o duplicada (`"a"b"`, `"a`, etc.) tiene comportamiento definido por la implementación; las plantillas portables usan exactamente un par balanceado por literal.

### Literales numéricos (según ADR-0028)

Un número decimal, opcionalmente con un `-` inicial para la negación. Formas permitidas: `5`, `-5`, `3.14`, `-3.14`, `0`. El signo menos Unicode `U+2212` NO se reconoce como signo (según la enmienda de ADR-0009).

**Los operadores unarios sobre expresiones que no son literales NO se admiten en XTL 0.x.** Todas las siguientes formas lanzan (**raise**) `xl3/eval/unsupported-syntax`:

- `+5`, `+[col]` (más unario)
- `--5`, `-(0 - 5)` (doble negación)
- `-[col]`, `-(expr)`, `-__config__[k]` (menos unario sobre no literal)

Solución para negar una columna: escribir `(0 - [col])` o `[col] * -1`.

## Operadores

### Aritmética — `+`, `-`, `*`, `/`

Ambos operandos deben (**MUST**) coercionarse a un número finito. Reglas de coerción según ADR-0023:

| Tipo de operando | Valor coercionado |
|---|---|
| Número (finito) | él mismo |
| Booleano | 1 (TRUE) / 0 (FALSE) |
| Vacío (según [Valores vacíos](./evaluation.md#valores-vacíos)) | 0 |
| Cadena que se analiza como número finito | número analizado |
| Cadena que no se analiza como número | error `xl3/eval/operand-coercion` |
| Fecha | error |
| Cualquier otra cosa | error |

El análisis de cadenas sigue ADR-0009 y ADR-0023: recortar y luego `Number()` sin producir `NaN`. Las comas se tratan como separadores de miles (`"1,234"` se analiza como `1234`); no hay notación científica en los literales; no se admite un `+` inicial. El signo menos Unicode `U+2212` no es un carácter de signo (según la enmienda de ADR-0009).

Según ADR-0064, la coerción cadena→número (distinta del análisis de literales) acepta estas formas:

| Forma | ¿Aceptada? | Ejemplo |
|---|---|---|
| Entero decimal | sí | `"42"`, `"-42"` |
| Fracción decimal | sí | `"3.14"`, `"-3.14"` |
| Separador de miles | sí | `"1,234"`, `"-1,234.56"` |
| Notación científica | sí | `"1e5"`, `"-1.5e-3"`, `"1.5E10"` |
| Prefijo hexadecimal `0x`/`0X` | no — error `xl3/eval/operand-coercion` | `"0x10"` |
| Prefijo binario `0b`/`0B` | no | `"0b101"` |
| Prefijo octal `0o`/`0O` | no | `"0o17"` |
| `+` inicial | no | `"+5"` |
| Prefijo de signo menos Unicode `U+2212` | no | `"−5"` |
| Produce `±Infinity` | no | `"Infinity"`, desbordamiento IEEE 754 |
| Caracteres no numéricos al final | no | `"5px"`, `"5 abc"` |
| Cadena multi-línea | no | una cadena que contiene un LF interno |

La asimetría entre el análisis de literales (estricto) y la coerción de cadenas (permisiva) es intencional: los literales los escribe el autor, mientras que las cadenas coercionadas provienen de datos (exportaciones CSV, sistemas financieros) donde la notación científica o hexadecimal aparece de forma natural.

```text
{{ [price] * [quantity] }}
{{ [total] / 10 }}
{{ [a] + [b] }}
{{ [a] - [b] }}
```

Ejemplos:

| Expresión | Resultado |
|---|---|
| `1 + 2` | 3 |
| `"10" + 5` | 15 |
| `"1,234" + 1` | 1235 |
| `TRUE + 1` | 2 |
| `[empty-cell] + 5` | 5 |
| `"abc" + 5` | error |

La división por cero produce una celda de error de Excel `#DIV/0!` (según ADR-0025). Una celda de expresión única numérica se renderiza como una celda de error real de Excel con valor `#DIV/0!`; en una celda con formato de texto, una celda de texto mixto o dentro de la concatenación con `&`, se sustituye la cadena `"#DIV/0!"` en su posición. Si el valor de error fluye hacia un operador aritmético posterior dentro de la misma expresión de celda (por ejemplo, `(1/0) + 5`), no logra coercionarse a un número finito y lanza (**raises**) `xl3/eval/operand-coercion` según la tabla anterior.

Los seis centinelas de error de Excel **del lado de la fuente** — `#N/A`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#NULL!` — se leen desde la fuente como el valor vacío según ADR-0017. Según ADR-0053, contribuyen `""` a las posiciones de texto mixto y de concatenación con `&` y lanzan (**raise**) `xl3/cell/numfmt-coercion` en celdas de expresión única con formato numérico o de fecha. `#DIV/0!` es el único centinela que el propio motor produce durante la evaluación XTL; sigue las reglas anteriores. Los autores que quieran un marcador visible de "ausente" para los centinelas del lado de la fuente envuelven la referencia de columna con `IFEMPTY([col], "missing")`.

### Concatenación de cadenas — `&`

Cada operando se convierte en cadena mediante la forma canónica de cadena (consulta [Comparación y coerción de cadenas](#comparación-y-coerción-de-cadenas)) y los resultados se unen. Siempre tiene éxito; no produce errores de tipo.

```text
{{ [item] & " (" & [size] & ")" }}
```

### Comparación — `=`, `!=`, `>`, `<`, `>=`, `<=`

Se usan en `IF()` y `@filter`. Siguen el algoritmo descrito en [Comparación y coerción de cadenas](#comparación-y-coerción-de-cadenas). Los tipos mixtos caen al orden por puntos de código de la forma canónica de cadena; no hay errores de coerción.

```text
=
!=
>
<
>=
<=
```

## Comparación y coerción de cadenas

Los operadores de comparación (`=`, `!=`, `>`, `<`, `>=`, `<=`) y el operador de concatenación `&` comparten un único modelo de coerción. Tanto las condiciones de `IF()` como las directivas `@filter` usan el algoritmo de comparación definido aquí. `@sort` usa el mismo algoritmo.

### Forma canónica de cadena

La forma canónica de cadena de un valor es:

- Un valor vacío (según [Valores vacíos](./evaluation.md#valores-vacíos)) es la cadena vacía `""`.
- Un booleano: `TRUE` o `FALSE` (en mayúsculas).
- Un número finito: la representación decimal más corta que identifica unívocamente al valor, usando `.` como separador decimal y sin notación científica para magnitudes en `[1e-6, 1e21)`. Los enteros omiten el punto decimal final. Coincide con ECMA-262 §6.1.6.1.13.
- Una cadena: la propia cadena.
- Una fecha: `YYYY-MM-DD` cuando el componente de hora es exactamente medianoche (`00:00:00`); en caso contrario, `YYYY-MM-DDTHH:mm:ss`. (Definido por ADR-0017; antes diferido desde ADR-0009.)

  Los componentes de fecha deben (**MUST**) leerse en UTC. Las celdas de Excel almacenan fechas seriales sin zona horaria que ExcelJS y librerías similares devuelven como objetos `Date` anclados en UTC; usar accesores de zona horaria local (`getFullYear`, `getMonth`, `getDate`) introduce desplazamientos de un día en cualquier host que no sea UTC. Los hosts que necesiten una fecha consciente de zona horaria (por ejemplo, un token de nombre de archivo "hoy en Seúl") deberían (**SHOULD**) calcularla fuera del renderer y pasarla a través de `__inputs__` o `__config__`.

Los números no finitos (`NaN`, `Infinity`, `-Infinity`) no deben (**MUST NOT**) surgir de operaciones conformes a la especificación. Si aparecen, se convierten a `""`.

### Algoritmo de comparación

Los operadores de comparación se aplican, en orden:

1. Si ambos operandos están vacíos, son iguales. `=` es verdadero; `!=` es falso; `>` y `<` son falsos; `>=` y `<=` son verdaderos.
2. Si exactamente uno de los operandos está vacío, `=` es falso y `!=` es verdadero. Para el ordenamiento, el valor vacío es menor que cualquier valor no vacío.
3. Si ambos operandos son números, o ambos son cadenas que se analizan como números finitos mediante "recortar y luego `Number()` sin producir `NaN`", compara numéricamente. La comparación numérica usa igualdad IEEE 754; por lo tanto, `0.1 + 0.2` no es igual a `0.3`. Las plantillas que necesiten tolerancia deben (**MUST**) redondear explícitamente con `ROUND()`.
4. Si ambos operandos son booleanos, compara como valores con `false` ordenado antes que `true`.
5. Si ambos operandos son fechas, compara por su timestamp subyacente. Esto captura el caso donde un operando es un `YYYY-MM-DD` con solo medianoche y el otro es un datetime — de lo contrario compararían como cadenas canónicas diferentes.
6. En caso contrario, compara las formas canónicas de cadena usando el orden de puntos de código Unicode. No se aplica colación consciente del locale. **Tampoco se aplica normalización Unicode** (ADR-0030) — NFC `한` (U+D55C) y NFD `한` (U+1112 U+1161 U+11AB) se renderizan igual pero comparan como cadenas distintas. Los autores con datos en formas mixtas normalizan aguas arriba.

### Concatenación con `&`

`&` convierte cada operando a su forma canónica de cadena y une los resultados en orden. El resultado de `&` es siempre una cadena.

## Funciones

Los nombres de función no distinguen mayúsculas/minúsculas. La especificación los escribe en mayúsculas.

Cada función orientada al usuario tiene una aridad normativa (consulta ADR-0024). Una llamada con el número incorrecto de argumentos lanza (**raises**) `xl3/eval/arity-mismatch` en tiempo de análisis/normalización, ANTES de evaluar cualquier operando.

| Función | Args | Notas |
|---|---|---|
| `IF` | 3 | condition, true-value, false-value |
| `IFEMPTY` | 2 | value, fallback (alias: `IFBLANK`) |
| `ROUND` | 2 | value, places |
| `ABS` | 1 | value |
| `TEXT` | 2 | value, format |
| `ROW` | 0 | índice de fila en el bloque de datos actual |
| `TODAY` | 0 | fecha UTC |
| `YEAR` | 1 | año de 4 dígitos de una fecha (UTC) — enmienda de ADR-0019 |
| `MONTH` | 1 | mes 1-12 de una fecha (UTC) — enmienda de ADR-0019 |
| `DAY` | 1 | día del mes 1-31 de una fecha (UTC) — enmienda de ADR-0019 |
| `EOMONTH` | 2 | fecha del último día del mes `N` meses desde una fecha (medianoche UTC) — enmienda de ADR-0019 |
| `EDATE` | 2 | fecha `N` meses desde una fecha, mismo día acotado (medianoche UTC) — enmienda de ADR-0019 |
| `DATEDIF` | 3 | conteo entero de unidades completas `"Y"`/`"M"`/`"D"` entre dos fechas (negativo cuando inicio > fin) — enmienda de ADR-0019 |
| `HYPERLINK` | 2 | url, label — produce una celda clicable — ADR-0039 |
| `UPPER` | 1 | letras en mayúsculas en una cadena — ADR-0044 |
| `LOWER` | 1 | letras en minúsculas en una cadena — ADR-0044 |
| `TRIM` | 1 | recorta espacios al inicio/final (los internos se preservan) — ADR-0044 |
| `IFERROR` | 2 | value, fallback — devuelve el fallback cuando value es un marcador de celda de error — ADR-0044 |
| `IFS` | par ≥ 2 | pares (cond, value); devuelve la primera rama veraz; `xl3/eval/no-match` si ninguna — ADR-0044 |
| `DATE` | 3 | year, mes 1-based, day — medianoche UTC — ADR-0044 |
| `ISBLANK` | 1 | true si el valor está vacío según ADR-0007; alias del predicado de IFEMPTY — ADR-0047 |
| `XLOOKUP` | 3 o 4 | value, lookup-array, return-array, [fallback] |
| `SUM` | 1 | referencia a columna |
| `AVERAGE` (alias `AVG`) | 1 | referencia a columna |
| `MIN` | 1 | referencia a columna |
| `MAX` | 1 | referencia a columna |
| `COUNT` | 0 o 1 | 0 = conteo de filas del bloque; 1 = conteo de no vacíos para la columna |
| `CONCAT` | 1+ | variádica; alternativa a `&` |

### IF

```text
{{ IF([quantity] > 100, "bulk", "normal") }}
```

Devuelve el segundo argumento cuando la condición es **veraz** (truthy); en caso contrario devuelve el tercer argumento.

Un valor es **veraz** salvo que sea uno de:

- El booleano `false`.
- El número `0`.
- Un valor vacío según [Valores vacíos](./evaluation.md#valores-vacíos) — ausente, `""`, o una cadena formada solo por espacios.

No existe un trato especial para las cadenas `"0"` o `"false"`. Una cadena con contenido distinto de espacios siempre es veraz, incluido un valor de flag con tipo de cadena `"0"` o `"false"`. Las plantillas que necesiten interpretar un flag así deben (**MUST**) comparar explícitamente, por ejemplo `IF([flag] = "1", …)`.

Las expresiones de comparación evalúan a un booleano y son veraces cuando la comparación se cumple.

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

Devuelve el segundo argumento cuando el primero está vacío según [Valores vacíos](./evaluation.md#valores-vacíos). En caso contrario devuelve el primer argumento.

### XLOOKUP

```text
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name], "(unknown)") }}
```

Busca `lookup_value` en `lookup_array` y devuelve el valor correspondiente de `return_array`. Los arrays deben (**MUST**) ser referencias en corchetes con prefijo de fuente (por ejemplo, `Customers[Account]`) y deben (**MUST**) provenir de la misma fuente.

La función recorre las filas de la fuente en el orden del libro de Excel y devuelve la primera fila cuya columna en `lookup_array` sea igual a `lookup_value` según el [Algoritmo de comparación](#algoritmo-de-comparación). Si ninguna fila coincide:

- Si se proporciona un cuarto argumento, lo devuelve.
- En caso contrario, es un error.

XTL 0.1 solo admite coincidencia exacta — sin comodines, coincidencia aproximada ni búsqueda inversa.

Según ADR-0060, el `lookup_value` (primer arg) y el `fallback` opcional (cuarto arg) son expresiones XTL completas. Pueden (**MAY**) ser literales, corchetes simples, corchetes con prefijo de fuente, llamadas a funciones o expresiones compuestas. Una referencia `Source[Column]` en cualquiera de las dos posiciones está sujeta a la regla de fuente activa (ADR-0012): se resuelve a la fila actual solo cuando `Source` es la fuente activa del bloque circundante; en caso contrario lanza (**raises**) `xl3/source/row-cross-block`. Las restricciones de los argumentos de tipo array (misma fuente, sin corchetes simples) solo aplican a `lookup_array` y `return_array`.

### Agregaciones

Las agregaciones operan sobre el conjunto de filas renderizadas actual.

```text
{{ SUM([total]) }}
{{ COUNT() }}
{{ COUNT([customer]) }}
{{ AVERAGE([price]) }}
{{ MIN([date]) }}
{{ MAX([date]) }}
```

`COUNT()` cuenta filas. `COUNT([field])` cuenta filas cuyo valor `[field]` no está vacío según [Valores vacíos](./evaluation.md#valores-vacíos).

Según ADR-0059, el único argumento de `SUM`, `AVERAGE` (y su alias `AVG`), `MIN`, `MAX`, y la forma de 1 arg de `COUNT` debe (**MUST**) ser una referencia a columna de la forma `[Column]` o `Source[Column]`. Cualquier otra forma (literal, expresión, llamada a función) lanza (**raises**) `xl3/eval/bad-aggregate-arg`. Los autores que necesiten una agregación calculada por fila o bien añaden una columna auxiliar aguas arriba o calculan el valor por fila en una celda separada.

### Funciones numéricas

```text
{{ ROUND([amount], 0) }}
{{ ABS([delta]) }}
```

`ROUND(value, places)` redondea al número de decimales indicado. El redondeo usa "half-away-from-zero" para coincidir con `ROUND()` de Excel (por ejemplo, `ROUND(2.5, 0)` es `3` y `ROUND(-2.5, 0)` es `-3`).

### Formato de texto

```text
{{ TEXT([date], "YYYY-MM-DD") }}
{{ TEXT([amount], "#,##0") }}
```

Para los formatos admitidos a continuación, `TEXT()` devuelve una cadena. Usa los formatos numéricos/de fecha de la celda de plantilla cuando la salida deba seguir siendo un valor numérico o de fecha.

XTL 0.1 define este subconjunto mínimo de formatos de `TEXT()`:

| Tipo | Tokens / formatos | Significado |
|---|---|---|
| Fecha/hora | `YYYY`, `YY`, `MM`, `DD`, `dd`, `HH`, `hh`, `mm`, `ss` | Campos del calendario rellenados con cero, salvo `YYYY` y `YY`. `DD` y `dd` son ambos día del mes. |
| Número | `0` | Entero redondeado sin separador de miles. |
| Número | `#,##0` | Entero redondeado con separador de miles `,`. |
| Número | `0.00` | Dos decimales fijos, sin separador de miles. |
| Número | `#,##0.00` | Dos decimales fijos con separador de miles `,`. |

El redondeo numérico de `TEXT()` usa la misma regla "half-away-from-zero" que `ROUND()`.

Los formatos fuera de esta tabla son extensiones en XTL 0.1. Una implementación puede (**MAY**) aceptar formatos adicionales, pero su salida exacta queda definida por la implementación y fuera de la conformidad central. Las plantillas portables deben (**MUST**) usar solo la tabla anterior.

### Funciones de fila y fecha

```text
{{ ROW() }}
{{ TODAY() }}
{{ TEXT(TODAY(), "YYYY-MM-DD") }}
```

`ROW()` devuelve el índice de fila 1-based dentro del bloque de repetición actual. Llamar a `ROW()` fuera de un bloque de repetición es un error. `TODAY()` devuelve la fecha UTC en tiempo de renderizado. Las implementaciones no deben (**MUST NOT**) usar la zona horaria local del runtime del host; las plantillas que necesiten una fecha específica del locale deberían (**SHOULD**) calcularla en el libro de origen o pasarla a través de `__config__` como un valor definido por el autor.

## Directivas

Las directivas se escriben como expresiones de plantilla, normalmente en filas inmediatamente encima de los bloques de datos.

```text
{{ @filter [Status] = "Open" }}
{{ @filter [Customer] in __lists__[IncludedCustomers] }}
{{ @filter [Category] !in __lists__[ExcludedCategories] }}
{{ @sort [total] desc }}
{{ @group [Region], [Customer] }}
{{ @top 10 }}
{{ @repeat right 3 }}
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
```

Los nombres de las directivas y las direcciones de ordenamiento no distinguen mayúsculas/minúsculas.

### Filter

```text
@filter [field] operator value
```

Operadores:

```text
=
!=
>
<
>=
<=
in
!in
```

`in` y `!in` requieren una referencia a lista de la forma `__lists__[<name>]` (según ADR-0011), donde `<name>` es la cabecera de columna dentro de la hoja reservada `__lists__`. La forma heredada de hoja de listas `_<name>` está retirada.

**Múltiples directivas `@filter` se componen con AND.** Una fila pasa el bloque solo si todos los predicados `@filter` se satisfacen. No hay forma `OR` en XTL 0.1; las plantillas que necesiten disyunción componen las alternativas con filtros de pertenencia `__lists__[…]` o pre-filtran la fuente aguas arriba.

```text
{{ @filter [Region] = "Seoul" }}
{{ @filter [Amount] > 10000 }}
```

Una fila pasa solo cuando se cumplen ambas condiciones.

### Sort

```text
@sort [field] asc
@sort [field] desc
```

Cuando se omite la dirección, se usa `asc`.

`@sort` es **estable**. Las filas cuya clave de ordenamiento es igual conservan su orden de origen. Con múltiples directivas `@sort`, la **primera** directiva es la clave de ordenamiento primaria y las posteriores son desempates en el orden en que aparecen. El orden de origen es el desempate final (coincidiendo con "Sort by … then by …" de Excel y `ORDER BY a, b` de SQL).

### Top

```text
@top 10
```

Mantiene las primeras N filas después de filtros y ordenamientos. Según ADR-0055, N debe (**MUST**) ser un entero positivo (≥ 1). `@top 0`, `@top -5` y `@top 05` (cero inicial) son errores de análisis que lanzan (**raise**) `xl3/directive/invalid-syntax`.

### Repeat Right

```text
@repeat right
@repeat right 3
```

Repite el bloque de datos detectado horizontalmente. El número opcional es el span de columnas por registro repetido; cuando se omite, el span de columnas es `1`. Según ADR-0055, el span de columnas debe (**MUST**) ser un entero positivo (≥ 1); `@repeat right 0` y `@repeat right -3` lanzan (**raise**) `xl3/directive/invalid-syntax`.

### Source

```text
@source <SourceName>
```

Acota el bloque de datos circundante a la fuente con nombre declarada en `__sources__` (según ADR-0012). Dentro del bloque, el corchete abreviado `[Column]` se resuelve a la fila de la fuente activa, y las agregaciones sobre `Source[Column]` funcionan como antes. Sin `@source`, la fuente activa es la `source_sheet` por defecto configurada en `__config__`.

La forma explícita `@source default` es legal y equivalente a omitir la directiva (ADR-0065). Los argumentos de nombre de fuente distinguen mayúsculas/minúsculas: `@source DEFAULT` lanza (**raises**) `xl3/source/undeclared` porque ninguna fila de `__sources__` declara ese nombre.

Referenciar una fuente no declarada es un error. Referenciar una columna que no está declarada en las cabeceras de la fuente es un error (`xl3/source/unknown-column`); un fallthrough silencioso a vacío enmascararía erratas.

### Join

```text
@join <JoinedSource> on <JoinedSource>[<key>] = <PrimarySource>[<key>]
```

Empareja cada fila primaria de un bloque `@source` con la primera fila coincidente de `<JoinedSource>` (según ADR-0014, semántica de inner-join, primera coincidencia). Las filas primarias sin coincidencia se descartan. Dentro del bloque, `<PrimarySource>[Column]` y el `[Column]` simple se resuelven a la fila primaria; `<JoinedSource>[Column]` se resuelve a la fila unida emparejada. Múltiples cláusulas `@join`, semántica de left-join y coincidencias multi-fila están fuera del alcance de XTL 0.1.

Ambos lados de la cláusula `on` deben (**MUST**) ser referencias en corchetes con prefijo de fuente; un lado debe (**MUST**) nombrar `<JoinedSource>` y el otro `<PrimarySource>`. Si cualquiera de las fuentes no está declarada en `__sources__`, o si la cláusula `on` está malformada, es un error.

### Group + Subtotal

```text
@group [Key1], [Key2], …, [KeyN]
```

`@group` particiona el conjunto activo de filas en grupos anidados de N niveles para la emisión intercalada de `@subtotal` dentro de un único bloque de datos (ADR-0038). La identidad del grupo usa la regla de igualdad de cadena canónica de ADR-0009; el orden de los grupos es orden de aparición **después** de aplicar `@filter` y `@sort` (`@group` por sí mismo no reordena).

Un bloque de datos puede (**MAY**) contener como mucho un `@group`. `@group` sin lista de claves lanza (**raises**) `xl3/group/missing-key`. `@group` es incompatible con `@repeat right` (`xl3/directive/invalid-syntax`).

Una fila `@subtotal` contiene una o más expresiones `{{ @subtotal <aggregate> }}`. Cada fila de subtotal se enlaza a un nivel de anidamiento de grupo — la **primera** fila `@subtotal` en orden de origen se enlaza a la clave más interna (`[KeyN]`), la siguiente se enlaza a `[KeyN-1]`, y así hacia fuera. El `@subtotal` más externo se dispara una vez al final del bloque de datos (es el patrón "total general vía subtotal más externo").

Cuerpos de agregación admitidos — cualquier otra cosa lanza (**raises**) `xl3/subtotal/bad-aggregate`:

- `SUM(<column-ref>)`
- `COUNT()` o `COUNT(<column-ref>)`
- `AVERAGE(<column-ref>)`
- `MIN(<column-ref>)`
- `MAX(<column-ref>)`

Las expresiones compuestas (`SUM([A]) - SUM([B])`, `IF(...)`, etc.) están diferidas. La referencia a columna dentro de la agregación sigue la misma forma `[Column]` / `Source[Column]` que en otros lugares; aplica la regla de alcance de la especificación de ADR-0038 § "Aggregate scoping" — la agregación opera sobre el conjunto de filas del grupo actual, no del bloque completo.

Según ADR-0058, una fila `@subtotal` puede (**MAY**) contener cualquier número de expresiones `{{ @subtotal <aggregate> }}` en celdas distintas. Todas comparten el único enlace de nivel de anidamiento de la fila (el nivel inferido del orden de fila) y se evalúan contra el mismo conjunto de filas de grupo en cada emisión. Mezclar tipos de agregación (`SUM` + `COUNT` + `AVERAGE`) y referencias a columna en una sola fila de subtotal está permitido.

Una fila `@subtotal` puede (**MAY**) también llevar celdas con texto literal, fórmulas estáticas y otras expresiones `{{ ... }}` que NO referencien columnas de la fila actual (no hay "fila actual" en el borde de un grupo). Referenciar una columna de la fila actual fuera de una agregación lanza (**raises**) un error de clase `xl3/expression/unknown-name`.

Los grupos vacíos — todas las filas de datos vacías (ADR-0007) — se omiten.

```text
{{ @sort [Region] }}
{{ @sort [Customer] }}
{{ @group [Region], [Customer] }}
{{ [Region] }} | {{ [Customer] }} | {{ [Amount] }}
"Customer subtotal" |                 | {{ @subtotal SUM([Amount]) }}
"Region subtotal"   |                 | {{ @subtotal SUM([Amount]) }}
```

Errores:

- `xl3/group/missing-key` — `@group` sin lista de claves.
- `xl3/subtotal/outside-group` — celda `@subtotal` en un bloque sin `@group`, o más filas `@subtotal` que claves de `@group`.
- `xl3/subtotal/bad-aggregate` — el cuerpo de `@subtotal` no es uno de `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, o su argumento no es una referencia a columna de la forma permitida.

## Claves de grupo

Los nombres de hoja usan claves de grupo simples porque los nombres de hoja de Excel no pueden contener `[` ni `]`:

```text
{{ Customer }}
```

Los patrones de archivo pueden usar claves de grupo simples o columnas de fuente entre corchetes:

```text
{{ Customer }}_report.xlsx
{{ [Customer] }}_report.xlsx
{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx
```
