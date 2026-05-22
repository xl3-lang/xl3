# Glosario

Términos usados en los documentos de la especificación XTL, los ADR y
los fixtures de conformidad. Cuando una definición referencia una
sección de otro documento, esa sección es normativa; esta página es
material de resumen.

## A

**Active source (fuente activa).** La fuente con nombre contra la que
se resuelven las referencias de campo en corchetes simples
(`[Column]`) dentro de un bloque de datos. Se establece con `@source`
o, en su ausencia, mediante la fuente por defecto declarada vía
`source_sheet` en `__config__`. (Consulta ADR-0012, evaluation.md
"External Data Sources".)

**Aggregate function (función de agregación).** Una función cuyo
argumento es una referencia a columna y cuyo resultado es un escalar
único sobre muchas filas: `SUM`, `AVERAGE`, `AVG`, `MIN`, `MAX`,
`COUNT`. Las agregaciones con prefijo de fuente (`SUM(Source[col])`)
operan sobre el conjunto completo de filas de la fuente; las
agregaciones simples (`SUM([col])`) operan sobre las filas filtradas
del bloque activo. (Consulta ADR-0012, language.md "Aggregates".)

## B

**Block (bloque).** Consulta *data block*.

**Bracket field (campo en corchetes).** Una referencia a columna de la
forma `[Column]`. Se resuelve contra la fila actual de la fuente activa
dentro de un bloque de datos. Fuera de un bloque de datos, es un error
de sintaxis. (Consulta language.md "Source Columns".)

## C

**Canonical string form (forma canónica de cadena).** La representación
determinista en cadena de un valor que usa la concatenación con `&`,
la pertenencia a listas y el respaldo de cadena del algoritmo de
comparación. Vacío → `""`; Booleano → `TRUE`/`FALSE` (en mayúsculas);
Número finito → la forma más corta y round-trippable de ECMAScript;
Cadena → ella misma; Fecha → `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm:ss`
(UTC). (Consulta ADR-0009, ADR-0017, language.md "Canonical String
Form".)

**Conformance corpus (corpus de conformidad).** El conjunto de
directorios de fixtures bajo `conformance/fixtures/`, cada uno con
`template.xlsx`, `data.xlsx`, opcionalmente `expected.xlsx` y
`meta.yaml`. El corpus es el contrato ejecutable: la prosa de la
especificación que contradiga a un fixture que pasa pierde. (Consulta
conformance/runner-protocol.md.)

## D

**Data block (bloque de datos).** Un rango contiguo de filas en una
hoja de plantilla que se expande una vez por cada fila coincidente de
la fuente en tiempo de renderizado. El renderizador los detecta
encontrando celdas con referencias simples `[Column]`; el rango puede
modificarse con las directivas `@source`, `@filter`, `@sort`, `@top`,
`@repeat right` y `@join`. (Consulta evaluation.md "Render Phases".)

**Default source (fuente por defecto).** La fuente implícita cargada
desde el libro referenciado por `__config__.source_sheet`. Dentro de
un bloque de datos sin directiva `@source`, es la fuente activa.
Nombre interno: `default`. Los autores no suelen escribir
`@source default` de forma explícita.

**Directive (directiva).** Un bloque de plantilla cuyo contenido
empieza con `@`. Las directivas modifican el bloque de datos
circundante. El conjunto de XTL 0.1: `@filter`, `@sort`, `@top`,
`@repeat right`, `@source`, `@join`. (Consulta language.md
"Directives".)

**Dunder (sheet) (hoja dunder).** Una hoja reservada cuyo nombre
coincide con el patrón `^__[a-z]+__$`, es decir, envuelta en dobles
guiones bajos. Las cuatro hojas dunder declaradas son `__config__`,
`__inputs__`, `__sources__` y `__lists__`. Las hojas creadas por el
autor que coincidan con el patrón se rechazan en tiempo de análisis.
(Consulta ADR-0011.)

## E

**Empty value (valor vacío).** Un valor que está ausente
(`null`/`undefined`), la cadena vacía o una cadena formada solo por
espacios en blanco Unicode. Los Números (incluido `0`), los Booleanos
(incluido `false`) y las Fechas NUNCA están vacíos, independientemente
de su valor. (Consulta ADR-0007, evaluation.md "Empty Values".)

**Excel error sentinel (centinela de error de Excel).** Una celda
cuyo valor es uno de `#N/A`, `#VALUE!`, `#DIV/0!`, etc. Se lee como
vacío según ADR-0017. Las implementaciones pueden (**MAY**) emitir una
advertencia cuando se encuentre una.

**Expression (expresión).** El contenido de un bloque de plantilla
`{{ ... }}`. Puede ser un literal, una llamada de función, una
referencia en corchetes, una referencia a una hoja reservada o
cualquier combinación de los anteriores unida por operadores.
(Consulta spec/grammar.ebnf para la gramática formal.)

## F

**File group (grupo de archivos).** Una agrupación de filas de la
fuente por las claves declaradas en las claves de agrupación de
`__config__.output_file_pattern`. Cada grupo se convierte en un
`.xlsx` de salida. Se emiten en orden de primera aparición sobre el
orden natural de filas de la fuente (según ADR-0016).

**Filter (filtro).** Una directiva que descarta filas de un bloque de
datos en función de un predicado. Dos formas: `@filter [field] op
value` y `@filter [field] in __lists__[name]` (o `!in`).

## G

**Group key (clave de agrupación).** Una columna cuyos valores
distintos dividen las filas de la fuente en grupos de archivos (cuando
la columna aparece en `output_file_pattern`) o grupos de hojas (cuando
aparece en la plantilla de nombre de una hoja).

## I

**Informational ADR (ADR informativo).** Un ADR cuyo estado es
`informational`: material de documentación, auditoría o proceso que
no vincula el comportamiento de la implementación. (Consulta ADR-0004
como ejemplo y 0000-template.md para la taxonomía de estados.)

**Input (entrada).** Un valor de tiempo de ejecución declarado en
`__inputs__` y suministrado por el host mediante la opción `inputs`
de `convert(...)`. Se coerciona según el `type` declarado (text,
number, date, select). (Consulta ADR-0010.)

## J

**Join.** Una directiva `@join` que empareja cada fila de la fuente
activa con la primera fila coincidente de una segunda fuente por
clave. XTL 0.1 soporta semántica de inner-join con ordenamiento
determinista de primera coincidencia. (Consulta ADR-0014.)

## L

**List sheet (hoja de listas).** Una columna dentro de `__lists__`
cuyos valores son el conjunto de pertenencia para `@filter ... in
__lists__[name]`. (Consulta ADR-0011, evaluation.md "List Sheets".)

## N

**Named source (fuente con nombre).** Una fuente declarada en
`__sources__` con un nombre explícito. Se referencia como
`Name[Column]` desde cualquier lugar donde un corchete con prefijo de
fuente sea válido. La fuente por defecto no tiene "nombre" en este
sentido.

## P

**Primary source (fuente primaria).** Dentro de un bloque `@join`, la
fuente activa: sus filas dirigen la iteración. La fuente unida aporta
columnas emparejadas a través de referencias `JoinedSource[Column]`.

## R

**Reserved sheet (hoja reservada).** Una de `__config__`,
`__inputs__`, `__sources__`, `__lists__`. Sus nombres y comportamientos
están definidos por ADR-0011. Las hojas creadas por el autor que
coincidan con el patrón dunder están reservadas (y rechazadas)
independientemente de que coincidan o no con uno de los cuatro nombres
declarados. Las hojas reservadas no aparecen en los libros de salida.

**Reserved-sheet reference (referencia a hoja reservada).** Una
expresión de plantilla de la forma `__sheet__[key]` que busca `key`
dentro de la tabla clave-valor de una hoja reservada. Es válida para
`__config__`, `__inputs__` y `__lists__`; la forma
`__sources__[name]` es un error (`xl3/sources/not-a-dictionary`)
porque `__sources__` es una hoja de declaración, no un diccionario de
valores.

## S

**Sheet group (grupo de hojas).** Una agrupación de filas de la fuente
por las claves del nombre de una plantilla de hoja. Cada grupo se
convierte en una hoja de salida dentro de su archivo. Se emiten en
orden de primera aparición (según ADR-0016).

**Single-expression cell (celda de expresión única).** Una celda cuyo
contenido de plantilla es exactamente un `{{ expression }}` y nada
más. Esas celdas preservan el tipo del valor de la fuente (una Fecha
sigue siendo Fecha, un Número sigue siendo Número) cuando el formato
numérico de la celda es compatible. (Consulta ADR-0003, evaluation.md
"Single-Expression Cells".)

**Source (fuente).** Una hoja de cálculo (o hoja + rango de tabla)
leída por el motor para proveer datos de fila. La fuente por defecto
proviene de `__config__.source_sheet`; las fuentes con nombre se
declaran en `__sources__`. (Consulta ADR-0012.)

**Source-prefixed bracket (corchete con prefijo de fuente).** Una
referencia de la forma `Source[Column]` donde `Source` es un nombre
de fuente declarado. Se resuelve a la columna de la fila actual de la
fuente dentro de un bloque `@source`, o alimenta una agregación o un
`XLOOKUP` sobre el conjunto completo de filas de esa fuente en
contextos estáticos. (Consulta ADR-0012.)

## T

**Template block (bloque de plantilla).** La sintaxis `{{ ... }}` que
delimita una expresión o directiva XTL dentro del valor de una celda
de Excel. (Consulta language.md "Template Blocks".)

**Truthy / falsy (veraz / falso).** Un valor es veraz salvo que esté
vacío (según ADR-0007), sea el Booleano `false` o el número `0`. Las
cadenas `"0"` y `"false"` son veraces porque son cadenas no vacías.
(Consulta ADR-0008.)

## X

**XLOOKUP.** Una función que encuentra la primera fila de una fuente
donde una columna de búsqueda es igual a un valor, y devuelve una
columna de esa fila. Refleja la firma de Excel para la forma básica
de 3 argumentos más un fallback opcional. Los modos de comodín,
aproximado y búsqueda inversa están fuera del alcance de XTL 0.1.
(Consulta ADR-0013, language.md "XLOOKUP".)

**XTL.** Excel Template Language (Lenguaje de Plantillas de Excel).
El lenguaje definido por `spec/`. Es neutral respecto a la
implementación; xl3 es la implementación de referencia en TypeScript.
