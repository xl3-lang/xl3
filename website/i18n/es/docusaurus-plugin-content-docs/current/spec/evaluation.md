# Evaluación de XTL

:::note
Esta traducción al español es una ayuda de lectura. La fuente canónica de la especificación es la [versión en inglés](https://xl3.io/spec/evaluation); en caso de divergencia normativa, prevalece el inglés.
:::

Este documento define cómo una implementación de XTL lee las entradas y produce las salidas.

## Entradas y salidas

Una conversión XTL toma:

```text
template.xlsx
data.xlsx
```

y produce uno o más archivos `.xlsx` de salida.

El libro de plantilla define la forma del libro de salida, las expresiones de plantilla, las reglas de agrupación, las directivas y la configuración. El libro de origen proporciona los datos tabulares.

## Hojas reservadas

xl3 define cuatro nombres de hoja reservados. Cualquier hoja cuyo nombre coincida con el patrón envuelto en dobles guiones bajos `__<name>__` está reservada para uso del motor. Los autores no deben (**MUST NOT**) crear hojas con esa forma; todo lo demás es contenido de plantilla.

| Hoja | Propósito |
|---|---|
| `__config__` | Objeto único de configuración — metadatos del motor + valores definidos por el autor |
| `__inputs__` | Declaraciones de entradas en tiempo de ejecución (colección; ver [Entradas](#entradas)) |
| `__sources__` | Declaraciones nombradas de fuentes externas de datos (colección; ver [Fuentes externas de datos](#fuentes-externas-de-datos), según ADR-0012) |
| `__lists__` | Listas de membresía definidas por el autor (colección; ver [Hojas de listas](#hojas-de-listas)) |

Las referencias al contenido de hojas reservadas desde expresiones de celda usan la forma de referencia estructurada de Excel `__sheet__[key]` — la misma forma usada para columnas multi-fuente en un ADR futuro. La sintaxis de referencia heredada `_<name>` se retira en esta versión.

## Configuración de la plantilla

Una hoja oculta llamada `__config__` puede (**MAY**) proporcionar metadatos y valores definidos por el autor. La columna A contiene la clave, la columna B contiene el valor.

| Clave | Significado | Ejemplo |
|---|---|---|
| `name` | Nombre visible de la plantilla | `Resumen de pedidos` |
| `description` | Texto libre | `Resumen mensual de pedidos` |
| `source_sheet` | Nombre de la hoja de origen, o patrón de prefijo terminado en `*` | `Pedidos`, `Datos_*` |
| `source_table` | Selector de la tabla de origen. La primera fila seleccionada contiene los nombres de columna; las filas debajo son datos. | `1`, `A1:D`, `B5:H200` |
| `output_file_pattern` | Plantilla del nombre del archivo de salida | `{{ __config__[customer] }}_report.xlsx` |
| `match_pattern` | Patrón de coincidencia por lotes | `Pedidos*` |
| cualquier otra clave | Valor definido por el autor | `title = Ventas Q2` |

`source_table` es el único selector de tabla de origen.

Los valores definidos por el autor usan cualquier clave no listada en la tabla del sistema anterior. Se referencian desde las celdas mediante `{{ __config__[key] }}`. Por ejemplo, una fila `title = Ventas Q2` se referencia como `{{ __config__[title] }}`. Los autores no deben (**MUST NOT**) reusar nombres de claves del sistema para valores definidos por el autor.

Según ADR-0056, la forma de lectura `__config__[key]` se resuelve al valor de la celda independientemente de si `key` es un slot del sistema o un slot definido por el autor. `{{ __config__[name] }}`, `{{ __config__[output_file_pattern] }}`, etc. son lecturas válidas. La restricción del lado de escritura (los autores no pueden DECLARAR una fila con un nombre de clave del sistema) no cambia. Leer una clave desconocida lanza (**raises**) `xl3/expression/unknown-name`.

Las plantillas que necesiten valores *por ejecución* usan la hoja `__inputs__` en su lugar (ver [Entradas](#entradas)).

## Fuentes externas de datos

Una plantilla puede (**MAY**) declarar fuentes de datos nombradas adicionales más allá de la predeterminada al proporcionar la hoja reservada `__sources__`. La fila 1 es el encabezado; cada fila subsiguiente declara una fuente.

| Columna | Requerida | Significado |
|---|---|---|
| `name` | sí | Nombre de la fuente. Solo letras, dígitos y guiones bajos. No debe (**MUST NOT**) comenzar con `__` y no debe (**MUST NOT**) ser `default` (reservado para la fuente implícita). |
| `sheet` | sí | Nombre de la hoja de origen en el libro de datos, o patrón de prefijo terminado en `*`. |
| `table` | no | Selector de tabla de origen para esa hoja, con valor predeterminado `1`. Misma sintaxis que `source_table` en `__config__`. |
| `description` | no | Nota de forma libre. |

Las implementaciones deben (**MUST**) identificar las columnas por el texto del encabezado, sin distinguir mayúsculas y minúsculas.

La fuente **default** implícita — declarada mediante filas `source_sheet` y `source_table` en `__config__` — siempre se llama `default`. No puede redeclararse en `__sources__`.

### Referencias de celda

`[Column]` sigue significando "la columna de la fila actual de la fuente activa." `Source[Column]` es la forma de referencia estructurada para una fuente nombrada:

```
{{ [Account] }}                   fila actual de la fuente activa
{{ Customers[Account] }}          fila actual de Customers (solo cuando está activa)
{{ SUM(Renewals[Amount]) }}       agregado sobre el conjunto completo de filas de Renewals
```

`Source[Column]` a nivel de fila es válido solo cuando `Source` es la fuente activa del bloque de datos circundante. Dentro de una función de agregación, `Source[Column]` siempre opera sobre el conjunto completo de filas de `Source` independientemente del bloque activo.

### Directiva `@source`

Un bloque de datos puede (**MAY**) acotar su iteración a una fuente nombrada:

```
{{ @source Customers }}
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}
{{ [Region] }}
```

El bloque de datos anterior se expande verticalmente por defecto — una fila renderizada por cada fila de origen — sin una directiva `@repeat` explícita (ver [Directivas](#directivas)).

Sin `@source`, la fuente activa es `default`. `@source` debe (**MUST**) aparecer antes de las directivas `@filter`/`@sort`/`@top` del mismo bloque (determina sobre qué conjunto de filas operan).

Referenciar una fuente no declarada — sea mediante `@source <Unknown>` o mediante `Unknown[Column]` — es un error.

### Directiva `@join`

Un bloque de datos puede (**MAY**) añadir **una** directiva `@join` inmediatamente después de `@source` para emparejar cada fila de la fuente primaria con una fila de una segunda fuente:

```
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ [Account] }} | {{ Customers[Name] }} | {{ [Amount] }}
```

Para cada fila primaria, el motor encuentra la **primera** fila unida que coincide (según [Algoritmo de comparación](./language.md#comparison-algorithm)) y renderiza el par. "Primera" se define por el orden natural de filas de la fuente unida — de arriba a abajo sobre su rango `source_table`. Esto es normativo: cuando varias filas unidas tienen una clave de unión igual, dos implementaciones deben (**MUST**) elegir la misma fila emparejada.

Si no se encuentra coincidencia, la fila primaria se **descarta** (semántica de inner-join).

Dentro del bloque, `[Column]` y `<PrimarySource>[Column]` se resuelven a la fila primaria; `<JoinedSource>[Column]` se resuelve a la fila unida emparejada. Las referencias a otras fuentes a nivel de fila siguen siendo un error.

Múltiples directivas `@join`, semántica de left-join y coincidencias multi-fila están fuera del alcance de XTL 0.1.

## Entradas

Una plantilla puede (**MAY**) declarar entradas en tiempo de ejecución al proporcionar una hoja reservada llamada `__inputs__`. La primera fila es un encabezado; cada fila subsiguiente declara una entrada.

| Columna | Requerida | Significado |
|---|---|---|
| `name` | sí | Nombre de la entrada. Debe constar únicamente de letras, dígitos y guiones bajos. |
| `type` | sí | Uno de `text`, `number`, `date`, `select`. |
| `default` | no | Si no está vacío, se usa cuando el host omite la entrada. El valor predeterminado se analiza según el `type` de la entrada. |
| `label` | no | Texto del prompt visible para el humano. Los hosts deberían (**SHOULD**) usarlo como etiqueta del formulario. |
| `description` | no | Ayuda opcional más extensa. |
| `options` | no | Requerido cuando `type = select`. Valores permitidos separados por barra vertical, p. ej. `Seoul\|Busan\|Daegu`. |

Las implementaciones deben (**MUST**) identificar las columnas por el texto del encabezado, sin distinguir mayúsculas y minúsculas. Las columnas más allá de las listadas arriba están reservadas y deben (**MUST**) ignorarse.

Una entrada es **requerida** cuando su fila no tiene `default`. Los hosts deben (**MUST**) suministrar cada entrada requerida; omitir una es un error.

Los valores resueltos de las entradas se referencian desde las celdas mediante `{{ __inputs__[name] }}`. Por ejemplo, una entrada declarada con `name = month` se referencia como `{{ __inputs__[month] }}`. `__inputs__[name]` se resuelve al valor resuelto y coercionado; no existe una forma de especificación para leer el `label`, el `default` o el `type` de una entrada desde dentro de una plantilla (los hosts usan la API `readTemplateInputs()`).

Los nombres de entrada no deben (**MUST NOT**) colisionar con valores definidos por el autor declarados como filas no del sistema en `__config__`; esto es un error en tiempo de análisis.

Según ADR-0062, una entrada es **requerida** cuando la celda `default` — *después* de la evaluación de ADR-0050 — produce un valor vacío según ADR-0007. Las formas "celda en blanco", `default = ""`, `default = "   "` y `default = {{ "" }}` colapsan todas en "requerida".

Según ADR-0063, la celda `options` se divide por `|` después de la evaluación; cada elemento se recorta de espacios en blanco Unicode y los elementos vacíos se descartan. `options = "Seoul | Busan"` produce `["Seoul", "Busan"]`; `options = "a||b"` produce `["a", "b"]`; `options = "||"` lanza (**raises**) `xl3/inputs/missing-options`. Las opciones duplicadas se preservan. Los valores `select` suministrados por el host se comparan distinguiendo mayúsculas y minúsculas contra el array resultante.

Las entradas se coercionan a partir de los valores suministrados por el host:

- `text` — deja pasar la cadena del host. Los valores no-cadena del host se convierten a cadena vía la forma de cadena canónica (ver [Comparación y coerción de cadenas](./language.md#comparison-and-string-coercion)).
- `number` — se analiza vía "recortar, luego `Number()` sin producir `NaN`". El fallo es un error.
- `date` — se coerciona por las mismas reglas que las celdas de expresión única con formato de fecha. El fallo es un error.
- `select` — el valor del host debe (**MUST**) ser igual a una de las `options` declaradas tras la normalización de forma canónica de cadena. El fallo es un error.

Los valores coercionados de entrada participan en `IF()`, `@filter`, `&`, comparaciones y `TEXT()` como cualquier otro valor.

### Evaluación de plantilla en `default` / `label` / `description` / `options`

Según ADR-0050, las celdas en las columnas `default`, `label`, `description` y `options` son plantillas XTL: texto contiguo más cero o más bloques `{{ ... }}`, evaluados en tiempo de lectura de entradas (antes de cargar cualquier fila de origen). El contexto de evaluación está intencionalmente restringido.

Enlaces disponibles:

- `__config__[key]` — valores definidos por el autor de la hoja `__config__` (analizados antes de `__inputs__`).
- Funciones escalares puras: `TODAY`, `DATE`, `IF`, `IFEMPTY`, `IFS`, `IFERROR`, `UPPER`, `LOWER`, `TRIM`, `TEXT`, `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`, `ROUND`, `ABS`.

Enlaces prohibidos (lanzan códigos de error estables):

- Referencias `[Column]` o `Source[Column]` sin más — aún no hay contexto de fila de origen en tiempo de lectura de entradas. Error: `xl3/inputs/forward-reference`.
- `__sources__[…]` o `__inputs__[name]` — las fuentes no están cargadas; las filas de entrada son declaraciones independientes. Error: `xl3/inputs/forward-reference`.
- `ROW()`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP` — dependientes del tiempo de renderizado o de los datos de origen. Error: `xl3/inputs/runtime-only-fn`.

La forma canónica de cadena post-evaluación (ver ADR-0009) es lo que fluye de vuelta a través de la UI del host como `InputSpec.default` / `InputSpec.label` / `InputSpec.description`. Para `options`, la cadena evaluada se divide luego por `|` para producir el array.

Para `default`, la cadena evaluada se coerciona posteriormente según el `type` declarado de la entrada mediante las reglas anteriores. Así `default = {{ TODAY() }}` con `type = date` produce la fecha ISO en tiempo de renderizado en el predeterminado post-coerción.

## Modelo de datos de origen

El modelo de datos de origen es una lista ordenada de filas. Cada fila es un mapeo del nombre de columna de origen al valor de celda.

`source_sheet` selecciona la hoja. Si se omite, se usa la primera hoja. Si `source_sheet` termina en `*`, es un patrón de prefijo. La implementación debe (**MUST**) seleccionar la primera hoja, en orden del libro, cuyo nombre comience con el prefijo antes de `*`. Si ninguna hoja coincide, es un error. Las coincidencias exactas de nombre de hoja tienen precedencia sobre la coincidencia por prefijo.

`source_table` se interpreta dentro de la hoja seleccionada:

| Forma | Significado |
|---|---|
| `N` | La fila `N` contiene los nombres de columna de origen. Las columnas de origen son las celdas no vacías desde la primera celda no vacía hasta la última celda no vacía. Las filas debajo de `N` son filas de datos hasta el final del rango de filas usado de la hoja. |
| `A1:D` | Las celdas `A1:D1` contienen los nombres de columna de origen. Las filas debajo son filas de datos hasta el final del rango de filas usado de la hoja. |
| `A1:D200` | Las celdas `A1:D1` contienen los nombres de columna de origen. Las filas `2:200` en las columnas `A:D` son filas de datos. |

Si se omite `source_table`, su valor predeterminado es `1`.

`N` debe (**MUST**) ser un entero positivo basado en 1. Las formas de rango deben (**MUST**) usar coordenadas A1 absolutas de Excel con una columna izquierda, una primera fila, una columna derecha y una fila final opcional. La columna izquierda no debe (**MUST NOT**) estar a la derecha de la columna derecha. La fila final opcional no debe (**MUST NOT**) estar por encima de la primera fila.

Cuando una forma de rango incluye una fila final igual a la primera fila, como `A1:D1`, la tabla de origen contiene nombres de columna y cero filas de datos. Esto es válido.

Las celdas de nombre de columna de la tabla de origen usan la misma extracción efectiva de texto/valor que las celdas de datos de origen antes del recorte.

Reglas para los nombres de columna:

1. Los valores de las celdas de nombre de columna de origen se convierten a cadenas y se recortan.
2. Los nombres de columna de origen distinguen mayúsculas y minúsculas.
3. Las celdas de nombre de columna de origen con texto enriquecido se leen concatenando los segmentos de texto.
4. Las celdas de nombre de columna de origen con fórmula usan el resultado de fórmula en caché. Si no hay resultado en caché disponible, es un error.
5. Los nombres de columna vacíos dentro de la tabla de origen seleccionada son errores.
6. Los nombres de columna de origen duplicados son errores.
7. Las filas de datos vacías se omiten.
8. Las celdas de encabezado fusionadas horizontalmente forman una columna en el índice de columna de la celda maestra de la fusión (según ADR-0033). Las celdas esclavas en la misma fila pero en una columna distinta de la maestra son transparentes: no contribuyen con una columna y no causan un error de nombre duplicado. Las fusiones verticales en la fila de encabezado leen el texto de la maestra en la columna de la esclava sin cambios. Si el rango seleccionado contiene solo celdas esclavas de una fusión (sin maestra en la ventana), es un error (`xl3/source/missing-header`); amplía el rango para incluir la maestra de la fusión.
9. Los saltos de línea dentro del texto de las celdas de encabezado (CRLF, CR o LF — incluidos los introducidos vía Alt+Enter) se normalizan a un **único espacio** (U+0020) en tiempo de lectura según la enmienda de ADR-0041. Múltiples saltos de línea consecutivos colapsan a un solo espacio. La forma con espacios colapsados es el nombre de la columna; las plantillas la referencian mediante la misma forma con espacios (`{{ [단위: 원] }}`). El recorte y la detección de vacío-después-de-recorte (regla 5) se aplican *después* de la normalización de saltos de línea. La normalización de encabezados es asimétrica respecto a las filas de datos, donde LF se preserva textualmente según el alcance original de ADR-0041.

Las celdas fusionadas en las **filas de datos** (filas debajo de la fila de encabezado) siguen una regla separada según ADR-0035: el valor de una celda esclava de fusión es el valor de la maestra de la fusión. Una fusión vertical que abarca *N* filas de datos produce *N* filas de datos, cada una compartiendo el valor de la maestra en esa columna. Una fusión horizontal en una fila de datos da a cada columna esclava el valor de la maestra en esa fila. La omisión de filas de datos vacías se evalúa *después* del broadcast de fusión. Los autores que quieran que una fusión vertical cuente como un único registro lógico deberían (**SHOULD**) deshacer la fusión de la región de datos de origen.

Para la abreviatura por número de fila (`source_table = N`), los huecos entre la primera y la última celda de nombre de columna no vacías son por tanto errores después de inferir el span de columnas de origen.

## Valores vacíos

Un valor está **vacío** si falta — la columna de origen no existe en esta fila, o la celda está en blanco — o si es una cadena cuyo contenido es enteramente espacio en blanco Unicode.

Los números, incluido `0`, nunca están vacíos. Los booleanos, incluido `false`, nunca están vacíos. Las fechas nunca están vacías. Las cadenas no vacías nunca están vacías. Una fórmula cuyo resultado en caché es la cadena vacía está vacía según esta regla.

Las celdas de error de Excel (`#N/A`, `#VALUE!`, `#DIV/0!`, `#REF!`, `#NAME?`, `#NUM!`, `#NULL!`) — sean estáticas o llevadas como resultado de fórmula en caché — también están vacías según esta regla (ADR-0017). Las implementaciones pueden (**MAY**) emitir una advertencia cuando encuentren una; las advertencias no deben (**MUST NOT**) cambiar la semántica de salida.

El predicado de vacío gobierna cada lugar donde la especificación se refiere a un valor vacío:

- `IFEMPTY(value, fallback)` devuelve `fallback` cuando `value` está vacío.
- `COUNT([field])` cuenta una fila cuando su valor `[field]` no está vacío.
- Una fila de origen está vacía cuando cada celda en el span de columnas de la tabla de origen está vacía. Las filas de datos vacías se omiten antes de la agrupación y el renderizado.
- Las entradas de hoja de lista se leen descartando las celdas vacías de la primera columna de la hoja.
- Un valor de fila de origen que esté vacío nunca coincide con `@filter [field] in __lists__[name]`. El mismo valor siempre coincide con `@filter [field] !in __lists__[name]`.

## Hojas de listas

Una plantilla puede (**MAY**) declarar listas de membresía nombradas al proporcionar una hoja reservada llamada `__lists__`. La fila 1 es el encabezado; cada celda de encabezado es el nombre de una lista. Debajo de la fila 1, cada columna contiene los valores de esa lista.

```
__lists__:
| fruits | allowed_status | excluded_regions |
|--------|----------------|------------------|
| apple  | open           | test             |
| banana | pending        | internal         |
| cherry | reviewing      |                  |
```

La hoja `__lists__`:

- Puede (**MAY**) ser visible, oculta o muy oculta en la plantilla.
- Debe (**MUST**) eliminarse de los libros de salida.
- Cada celda se convierte a su forma canónica de cadena según [Comparación y coerción de cadenas](./language.md#comparison-and-string-coercion) y se recorta de espacios en blanco Unicode. Las celdas vacías tras el recorte (según [Valores vacíos](#valores-vacíos)) se omiten.
- El orden dentro de cada columna se preserva. Las entradas duplicadas no se eliminan.

Las listas se referencian desde directivas de filtro:

```
{{ @filter [Fruit] in __lists__[fruits] }}
{{ @filter [Status] !in __lists__[allowed_status] }}
```

`__lists__[name]` es un array de lista. Es válido solo dentro de `@filter ... in` y `@filter ... !in`; usarlo en otros sitios lanza (**raises**) `xl3/lists/invalid-use` según ADR-0057. Esto cubre referencias a listas en expresiones de celda, como operandos de `=`/`!=`/etc., como argumentos de función y como argumentos de `@sort`/`@top`.

Referenciar un nombre de lista no declarado en `__lists__` (o referenciar `__lists__[name]` cuando no existe una hoja `__lists__`) lanza (**raises**) `xl3/lists/missing-reference`.

## Fases de renderizado

Las implementaciones deben (**MUST**) renderizar en este orden conceptual:

1. Analizar `__config__`, `__inputs__`, `__lists__`, plantillas de hoja, directivas y variables.
2. Leer las filas de origen.
3. Resolver las columnas de origen referenciadas por las expresiones de plantilla.
4. Dividir las filas de origen en grupos de archivo según `output_file_pattern`.
5. Dividir los grupos de archivo en grupos de hoja según las claves de grupo del nombre de hoja.
6. Aplicar directivas al conjunto de filas actual.
7. Expandir bloques de repetición.
8. Evaluar celdas estáticas y celdas de datos.
9. Eliminar las hojas reservadas `__<name>__` y las filas de directiva de la salida.
10. Escribir los archivos de salida.

La estrategia de implementación exacta puede diferir, pero la salida observable debe (**MUST**) coincidir con este orden.

## Ordenación

La ordenación de la salida es determinista y guiada por la fuente:

- Los **grupos de archivo** aparecen en orden de **primera aparición**. El motor recorre las filas de origen en el orden natural de la fuente; la primera fila cuyo `output_file_pattern` se evalúa al nombre de archivo `X` causa que ese grupo se emita primero.
- Los **grupos de hoja dentro de un archivo** aparecen en orden de **primera aparición** sobre la lista de filas del grupo de archivo. La primera fila coincidente determina la posición de la hoja.
- El orden de iteración de fuente única es la lectura de `source_table` de arriba a abajo. Con datos multi-fuente (ver [Fuentes externas de datos](#fuentes-externas-de-datos)) la regla se aplica a las filas de la fuente *primaria*; las fuentes nombradas contribuyen a agregados y joins pero no afectan al orden de salida.

La estabilidad de ordenamiento se define en [`@sort`](./language.md#sort): las claves de ordenamiento iguales preservan el orden de origen.

## Directivas

Las directivas se aplican en este orden:

```text
source -> join -> filter -> sort -> group -> top -> repeat
```

Múltiples filtros se combinan con AND lógico. Con múltiples ordenamientos, el primer `@sort` es la clave primaria y los ordenamientos posteriores son desempatadores.

`@group` (ADR-0038) particiona el conjunto de filas post-filtro / post-ordenamiento en grupos anidados de N niveles y guía la emisión intercalada de filas `@subtotal` dentro de un único bloque de datos. El orden de grupo es el orden de encuentro *después* de `@sort`; `@group` por sí mismo no reordena. `@top` se aplica después del agrupamiento a nivel de fila — las filas de subtotal solo se emiten para grupos cuyas filas de datos sobrevivieron al corte de `@top`.

`@repeat right` cambia la dirección de expansión del bloque y no es una directiva de filtrado de datos. Sin un `@repeat` explícito, los bloques de datos se expanden verticalmente (hacia abajo) — una fila renderizada por cada fila de origen.

## Extracción de texto de celda

El análisis de expresiones de plantilla y la lectura de filas de origen operan sobre el texto/valor efectivo de cada celda:

- Las celdas de tipo cadena, número, booleano y fecha se leen como sus valores de celda.
- Las celdas de texto enriquecido se leen como la concatenación de sus segmentos de texto, en orden.
- Las celdas con fórmula no son recalculadas por XTL. Si el libro contiene un resultado de fórmula en caché, se usa ese resultado en caché. Si una celda con fórmula se lee como valor de datos de origen y no hay resultado en caché disponible, es un error.

## Modelo de valor de origen

Un valor de origen es uno de los siguientes tipos (según ADR-0017):

| Tipo | Notas |
|---|---|
| Missing | La columna de origen no existe en esta fila, o la celda está en blanco. Vacío según [Valores vacíos](#valores-vacíos). |
| String | Texto Unicode. Vacío según ADR-0007 solo cuando es enteramente espacio en blanco. |
| Number | Doble IEEE 754. `NaN` e infinitos no son producidos por operaciones conformes a la especificación; se convierten a cadena `""` y fluyen como vacíos. |
| Boolean | `TRUE` / `FALSE`. |
| Date | Un instante de calendario; puede llevar o no un componente de hora. |

Las formas de celda de Excel se mapean a tipos:

| Celda de Excel | Tipo XTL |
|---|---|
| En blanco | Missing |
| String / inline / shared string | String |
| Número (incl. fechas almacenadas como seriales con formato no fecha) | Number |
| Celda con formato de fecha | Date |
| Booleano | Boolean |
| Fórmula con resultado en caché | El tipo del resultado |
| Celda de error (`#N/A`, `#VALUE!`, `#DIV/0!`, …) | Missing (según [Valores vacíos](#valores-vacíos)) |

Una celda de Excel con formato de porcentaje fluye como su valor Number subyacente (50% → `0.5`). Las plantillas que necesiten salida formateada usan `TEXT(value, "0%")` (un formato de extensión fuera de la tabla central de XTL 0.1) o dependen de la preservación del formato numérico de la celda de plantilla.

## Evaluación de celdas

### Celdas de expresión única

Una celda cuyo contenido completo es una expresión de plantilla es una celda de expresión única:

```text
{{ [OrderDate] }}
```

Según ADR-0052, el "contenido completo" se evalúa contra el texto de la celda después de **recortar los espacios en blanco Unicode al principio y al final**. Una celda `  {{ [OrderDate] }}  ` (con solo espacio en blanco alrededor) es una celda de expresión única. El espacio en blanco recortado no forma parte del valor renderizado.

Los bloques de plantilla adyacentes sin separador — `{{ [A] }}{{ [B] }}` — NO son una celda de expresión única. Son celdas de texto mixto según la regla siguiente; sus resultados se unen como cadenas canónicas. Los autores que quieran un comportamiento de expresión única que preserve el tipo usan la forma explícita `&`: `{{ [A] & [B] }}`.

Las celdas de expresión única preservan el tipo del valor evaluado siempre que sea posible.

Si la celda de plantilla tiene un formato numérico/de fecha/de texto, la implementación debe (**MUST**) coercionar los valores de origen tipo cadena para coincidir con ese formato:

- Los formatos tipo fecha coercionan cadenas de fecha admitidas o números seriales de Excel a fechas.
- Los formatos tipo numérico coercionan cadenas numéricas a números.
- El formato de texto `@` coerciona a cadena.

Si la coerción falla, la implementación debe (**MUST**) reportar un error.

El conjunto mínimo de formatos de fecha admitidos y tokens de formato numérico no está definido normativamente por XTL 0.1 y se deja a cada implementación. Las implementaciones que admitan menos formatos que otra implementación pueden declarar conformidad parcial.

### Celdas de texto mixto

Una celda que contiene texto literal alrededor de una o más expresiones es una celda de texto mixto:

```text
Order date: {{ [OrderDate] }}
```

Una celda que contiene bloques de plantilla adyacentes sin separador (`{{ [A] }}{{ [B] }}`) también es una celda de texto mixto según ADR-0052.

Las celdas de texto mixto se renderizan como cadenas. Los formatos numéricos/de fecha de la plantilla no coercionan las celdas de texto mixto. Los valores vacíos según [Valores vacíos](#valores-vacíos) (incluidos los seis centinelas de error de Excel del lado de origen según ADR-0053) contribuyen con `""` en su posición; el `#DIV/0!` producido por el motor sustituye con la cadena literal `"#DIV/0!"` en su posición (ADR-0025).

### Función TEXT

Para los formatos centrales de XTL 0.1, `TEXT(value, format)` devuelve una cadena. Está pensada para nombres de archivo y cadenas de visualización explícitas, no para celdas que deben permanecer como valores numéricos/de fecha.

Los formatos fuera de la tabla central `TEXT()` de XTL 0.1 son extensiones definidas por la implementación. El corpus de conformidad no afirma un resultado específico para esos formatos.

## Nombres de archivo de salida

Cada nombre de archivo de salida producido por la evaluación de `output_file_pattern` debe (**MUST**) sanitizarse en este orden:

1. **Reemplazar los caracteres prohibidos** con `_`:
   - El conjunto `< > : " / \ | ? *`
   - Caracteres de control ASCII en el rango `0x00`-`0x1F`.
2. **Recortar** los espacios en blanco al principio y al final y los caracteres `.` al final.
3. **Protección de nombres reservados:** si el nombre base resultante (antes de la extensión `.xlsx`), sin distinguir mayúsculas y minúsculas, es igual a uno de `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, añade un único `_` al nombre base.
4. Si los pasos 1-3 producen un nombre de archivo vacío o un nombre base vacío, es un error.
5. Si la longitud en bytes UTF-8 del nombre de archivo resultante supera 255, es un error. Las implementaciones no deben (**MUST NOT**) truncar silenciosamente.
6. Las implementaciones deberían (**SHOULD**) emitir una advertencia cuando cualquiera de los pasos 1-3 cambie la cadena renderizada, incluyendo el nombre original y el sanitizado. Las advertencias no deben (**MUST NOT**) cambiar la semántica de salida.

Estas reglas se aplican solo a nombres de archivo. Los nombres de hoja siguen el conjunto prohibido propio de Excel y el límite de 31 caracteres, definidos por separado por la implementación.

Los caracteres Unicode (p. ej., CJK, letras acentuadas, emoji) no están restringidos: cualquier punto de código fuera del conjunto explícitamente prohibido se preserva.

## Estilos y estructura del libro

Las implementaciones deben (**MUST**) preservar verbatim las siguientes características de la plantilla en la salida renderizada (según ADR-0036):

- Estilo de celda (fuente, relleno, borde, alineación)
- Formato numérico/de fecha
- Alto de fila y ancho de columna
- Celdas fusionadas tanto en la plantilla como en las filas de datos de origen (según ADR-0033 para encabezados de origen y ADR-0035 para filas de datos de origen)
- Imágenes y sus rangos de anclaje
- Reglas de formato condicional y sus rangos `sqref`
- Rangos nombrados / nombres definidos (de alcance de libro y de alcance de hoja)
- Área de impresión y títulos de impresión (filas / columnas que se repiten)
- Inmovilizar paneles / dividir (vistas de hoja `views`)
- Estado de protección de hoja y banderas locked / hidden por celda
- Reglas de validación de datos (desplegables, restricciones de rango) y sus rangos
- Comentarios de celda (notas)

Esto se preserva **verbatim**. Los rangos, anclajes y referencias **no** se autoextienden cuando `@repeat` expande filas: el motor lleva la codificación de la plantilla a la salida sin cambios. Los autores que necesiten que una regla (p. ej., formato condicional) cubra filas expandidas por repetición deberían (**SHOULD**) anclarla con referencias de columna entera en la plantilla (p. ej., `$A:$A`) en lugar de depender de la extensión del lado del motor.

Los gráficos son **definidos por la implementación** en XTL 0.1 (según ADR-0036 ítem 3 y ADR-0006); un port puede preservar, perder o preservar parcialmente los objetos de gráfico. Un ADR futuro fijará normativamente el comportamiento de los gráficos cuando la conformidad de Etapa 2 llegue a los gráficos.

La preservación de estilo no anula la semántica de valor. Por ejemplo, una cadena devuelta por `TEXT()` sigue siendo una cadena incluso si la celda de plantilla tiene formato de fecha.

## Errores

Las siguientes condiciones son errores:

- Referenciar una columna de origen que no existe (`xl3/source/unknown-column`).
- Referenciar una fuente no declarada en `__sources__` (`xl3/source/undeclared`).
- Referenciar una lista dentro de `__lists__` que no existe (`xl3/lists/missing-reference`).
- Usar una directiva inválida.
- Usar un `source_table` inválido.
- Usar nombres de columna de origen vacíos o duplicados.
- Hojas creadas por el autor que coincidan con el patrón reservado de dobles guiones bajos `^__[a-z]+__$` (según ADR-0011, `xl3/sheet/reserved-name`).
- Referenciar la hoja de declaración `__sources__` como un diccionario de valores (p. ej., `__sources__[Customers]`, `xl3/sources/not-a-dictionary`); usa el nombre de la fuente directamente.
- Fallar al coercionar el valor de una celda de expresión única al formato de la celda de plantilla (`xl3/cell/numfmt-coercion`).
- Producir un nombre de archivo de salida inválido después de aplicar las reglas de sanitización (`xl3/filename/empty`, `xl3/filename/too-long`).
- Llamar a `ROW()` fuera de un bloque de repetición (`xl3/cell/row-outside-repeat`).
- Celdas con fórmula de origen sin resultados en caché (`xl3/cell/formula-no-cache`).
- `__inputs__` requeridos ausentes (`xl3/inputs/missing-required`), valor de entrada inválido, o valor `select` no presente en `options` (ver ADR-0010 para el catálogo completo de errores de entrada).
- XLOOKUP sin coincidencia y sin fallback (`xl3/xlookup/no-match`), argumento en corchetes simples (`xl3/xlookup/bare-bracket`), o arrays con fuente desajustada (`xl3/xlookup/source-mismatch`).
- `@join` referenciando una fuente no declarada (`xl3/join/undeclared-source`) o una cláusula `on` malformada (`xl3/join/bad-on-clause`).
- Referencia a nivel de fila a la columna de una fuente no activa (`xl3/source/row-cross-block`).
- Sintaxis de expresión no admitida — `+`/`--` unarios, o `-` unario sobre un no literal (referencia de columna, referencia a hoja reservada o subexpresión) (`xl3/eval/unsupported-syntax`, según ADR-0028).
- Sintaxis de directiva inválida — `@source` o `@join` duplicado en el mismo bloque de datos, o cuerpo de directiva vacío (`xl3/directive/invalid-syntax`, según ADR-0029); `@top` o `@repeat right` cuyo entero no sea ≥ 1 (según ADR-0055).
- Bloque de plantilla con un literal de cadena no balanceado — generalmente un `}}` incrustado dentro de `"..."` (`xl3/parser/unbalanced-literal`, según ADR-0051).
- Identificador simple en una celda de datos que no se resuelve a un literal booleano (`xl3/expression/unknown-name`, según ADR-0054).
- Referencia `__lists__[name]` usada fuera de las posiciones `@filter ... in` / `@filter ... !in` (`xl3/lists/invalid-use`, según ADR-0057).
- Función de agregación (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` de 1 arg) cuyo argumento no es una referencia `[Column]` o `Source[Column]` (`xl3/eval/bad-aggregate-arg`, según ADR-0059).

Según ADR-0015, cada error definido por la especificación lleva un `error.code` estable de la forma `xl3/<category>/<id>`. Los hosts usan el código para localización y despacho programático; el `Error.message` en inglés sigue siendo el contrato de conformidad.

Las implementaciones pueden (**MAY**) proporcionar advertencias para problemas de portabilidad no fatales, pero las advertencias no deben (**MUST NOT**) cambiar la semántica de salida.

## Límites de recursos

### Postura a nivel de especificación

Los límites de recursos — tamaño máximo de plantilla de entrada, número máximo de filas de origen, tamaño máximo del libro de salida, número máximo de iteraciones para `@repeat`, profundidad máxima de recursión — están **definidos por la implementación**. La especificación XTL 0.1 no obliga a límites específicos. Las implementaciones deberían (**SHOULD**) documentar sus límites y deberían (**SHOULD**) lanzar un código de error estable `xl3/limits/...` cuando se alcance un límite, pero los códigos en sí mismos no forman parte del contrato de la especificación porque los hosts varían ampliamente en su forma de despliegue (navegador, CLI, servidor) y modelo de amenazas.

Los hosts que acepten plantillas no confiables (p. ej., un SaaS que acepta `.xlsx` subidos por usuarios) deben (**MUST**) imponer sus propios límites en una capa por encima del motor — sandboxing, límites de tamaño de solicitud, timeouts — y no deberían (**SHOULD NOT**) depender del motor para detectar entradas maliciosas.

### Límites de implementación — implementación de referencia (xl3-js)

La implementación de referencia publica los siguientes límites soft (puerta G21 del ROADMAP). Estos son *límites de corrección*, no límites de seguridad — los hosts que acepten entrada no confiable deben (**MUST**) añadir su propia capa de aplicación según [`SECURITY.md`](../SECURITY.md). Los valores siguientes son borrador para 0.6.0 y se ajustarán a medida que aterrice el corpus de bench (G8).

| Dimensión | Límite soft (borrador) | Comportamiento al alcanzar el límite |
|---|---|---|
| Filas de origen por bloque | 1.000.000 | definido por la implementación; el modelo en memoria de ExcelJS es el cuello de botella |
| Total de celdas por hoja de salida | El máximo de Excel 17.179.869.184 (el techo duro de 1.048.576 × 16.384) | xl3 no sintetiza celdas más allá del techo de hoja de Excel; una salida que lo excedería lanza un error |
| Número de iteraciones de `@repeat` | acotado por el número de filas de origen | sin tope de iteración separado; la propia fuente es el regulador |
| Recuento de `__sources__` | definido por la implementación; sin límite de la especificación | el límite superior declarado se expone solo vía advertencias |
| Recuento de archivos de grupo de salida | definido por la implementación | la implementación de referencia emite un archivo por grupo; el host debería (**SHOULD**) ponerle tope externamente |

### Política de streaming

La implementación de referencia carga plantillas y datos completamente en memoria en 1.x. **La E/S por streaming está explícitamente aplazada a 1.1+**: requiere canonicalización, watermarking y una API de back-pressure que cambiaría la superficie pública. Los hosts que necesiten conversión a escala deberían (**SHOULD**) fragmentar en el límite de la *fuente* (dividir una tabla de 10 M de filas en 10 conversiones de 1 M de filas) en lugar de esperar al streaming.

### AbortSignal

`convert()` y `preview()` aceptan un `AbortSignal` opcional en su argumento `options` (planeado para 0.7-0.8 según la puerta G21). Cuando la señal aborta, la conversión en curso lanza un código de error estable (`xl3/abort/cancelled`); no se emite salida parcial. Los hosts que compitan conversiones contra un presupuesto de reloj de pared usan este hook para imponer timeouts de forma determinista.

Esta API es **compatible hacia adelante** — añadir el argumento opcional a `ConvertOptions` no afecta a los llamadores existentes; el código de error es solo de adición según ADR-0015.
