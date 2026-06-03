# Índice de navegación de la especificación

Una tabla de referencias cruzadas para porteadores y revisores. Cada
fila enlaza una sección de lenguaje/evaluación con los ADR que la
definen y con los fixtures de conformidad que la validan. Úsala cuando
quieras responder "¿dónde está el texto vinculante sobre X?" sin
recurrir a grep.

La columna de fixtures muestra el fixture (o fixtures) de menor número;
consulta [`coverage.md`](/es/conformance/coverage) para la matriz
completa ADR ↔ fixture.

| Superficie | Sección de la especificación | ADR que la rigen | Fixtures de muestra |
|---|---|---|---|
| Bloques de plantilla `{{ ... }}` | language.md "Template Blocks" | — | 001 |
| Columnas de fuente `[Col]` | language.md "Source Columns" | — | 001, 002 |
| Corchetes con prefijo de fuente `Source[Col]` | language.md "Source Columns"; evaluation.md "External Data Sources" | ADR-0012 | 069, 070, 071 |
| Literales (cadena / número / booleano) | language.md "Literals" | — | 011, 012 |
| Operadores (`=`, `!=`, `>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/`, `&`) | language.md "Operators" | ADR-0009 | 058, 059, 061 |
| Algoritmo de comparación | language.md "Comparison Algorithm" | ADR-0009, ADR-0017 | 059–064, 087, 088 |
| Forma canónica de cadena | language.md "Canonical String Form" | ADR-0009, ADR-0017 | 061–063, 087 |
| `IF()` | language.md "IF" | ADR-0008 | 055–058 |
| `IFEMPTY()` | language.md "IFEMPTY" | ADR-0007 | 050, 051 |
| `XLOOKUP()` | language.md "XLOOKUP" | ADR-0013 | 074–078 |
| Agregaciones (`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`) | language.md "Aggregates" | ADR-0007, ADR-0012 | 052, 070, 091 |
| `ROUND()` / `ABS()` | language.md "Numeric Functions" | — | 005, 016 |
| `TEXT()` | language.md "Text Formatting" | — | 011, 012, 016 |
| `ROW()` | language.md "Row and Date Functions" | — | 037 |
| `TODAY()` | language.md "Row and Date Functions" | ADR-0001 | 023 |
| `@filter` | language.md "Filter" | ADR-0007 (pertenencia), ADR-0009 (comparación) | 003, 035, 054 |
| `@sort` | language.md "Sort" | ADR-0009, ADR-0016 | 036, 083, 084 |
| `@top` | language.md "Top" | — | 036 |
| `@repeat right` | language.md "Repeat Right" | — | 004 |
| `@source` | language.md "Source"; evaluation.md "External Data Sources" | ADR-0012 | 071, 072 |
| `@join` | language.md "Join"; evaluation.md "External Data Sources" | ADR-0014 | 079–082 |
| Claves de agrupación | language.md "Group Keys" | ADR-0016 | 015, 085, 086 |
| Valores vacíos | evaluation.md "Empty Values" | ADR-0007 | 050–054 |
| Veracidad (truthiness) | evaluation.md (referencia cruzada) | ADR-0008 | 055–058 |
| Hojas reservadas (dunder) | evaluation.md "Reserved Sheets" | ADR-0011 | 094 |
| `__config__` | evaluation.md "Template Configuration" | ADR-0011 | la mayoría |
| `__inputs__` | evaluation.md "Inputs" | ADR-0010, ADR-0011 | 065–068 |
| `__sources__` | evaluation.md "External Data Sources" | ADR-0011, ADR-0012 | 069–073 |
| `__lists__` | evaluation.md "List Sheets" | ADR-0007, ADR-0011 | 053, 054 |
| Modelo de valor de fuente | evaluation.md "Source Value Model" | ADR-0017 | 087–090 |
| Modelo de datos de fuente (cero filas, lectura de cabeceras) | evaluation.md "Source Data Model" | — | 028–031 |
| Extracción de texto de celda | evaluation.md "Cell Text Extraction" | — | 013, 014 |
| Celdas de expresión única / coerción numFmt | evaluation.md "Single-Expression Cells" | ADR-0003 | 008–010 |
| Nombres de archivo de salida | evaluation.md "Output Filenames" | ADR-0002 | 006, 007, 019, 020 |
| Errores (catálogo) | evaluation.md "Errors" | ADR-0015 | 017–022, 067, 072–082, 091 |
| Límites de recursos | evaluation.md "Resource Limits" | — | (definido por la implementación; sin fixtures) |
| Fases de renderizado | evaluation.md "Render Phases" | — | 002 |
| Ordenamiento | evaluation.md "Ordering" | ADR-0016 | 083–086 |
| Canonicalización OOXML de Etapa 2 | conformance/runner-protocol.md "Stage 2" | ADR-0006 | 024–027, 093 |
| Aserciones dinámicas de conformidad | conformance/runner-protocol.md "Dynamic" | ADR-0005 | 023 |
| Compatibilidad con versiones de Excel | (informativo) | ADR-0022 | (sin fixtures; orientación para autoría) |
| Coerción de operadores y principio "Excel-default" | language.md "Arithmetic" | ADR-0023 | 100, 101 |
| Aridad de funciones (tabla normativa) | tabla de aridad de language.md "Functions" | ADR-0024 | 102, 103 |
| División por cero → celda de error `#DIV/0!` | language.md "Arithmetic" | ADR-0025 | 106 |
| Múltiples `@filter` se componen con AND | language.md "Filter" | (sin ADR; línea de especificación) | 104 |
| Espacios en blanco no significativos en `{{ }}` | language.md "Template Blocks" | (sin ADR; línea de especificación) | 105 |
| Ciclo de vida del valor vacío (celda + clave de grupo) | evaluation.md "Source Data Model" + "Output Filenames" | ADR-0026 | 107, 108 |
| Nombres de columna reservados + validación de directivas | evaluation.md "Source Data Model" + "Directives" | ADR-0027 | 109, 110, 111 |
| Restricciones de sintaxis de literales (cadena + número) | language.md "Literals" | ADR-0028 | 112, 113 |
| Composición de directivas + semántica de borde de fuente | evaluation.md "External Data Sources" + "Source Data Model" | ADR-0029 | 114, 115, 116, 117 |
| Normalización Unicode (ninguna aplicada) | language.md "Comparison Algorithm" | ADR-0030 | 118 |
| Colisión de nombre de archivo de salida es un error | evaluation.md "Output Filenames" | ADR-0031 | 119 |
| Límites de casos especiales y paso directo del libro | evaluation.md "Source Data Model" + "Cell Evaluation" | ADR-0032 | 120 |

## Fronteras definidas por la implementación

XTL 0.1 deja deliberadamente estas áreas a las implementaciones.
Elegir de forma distinta entre dos ports NO hace que ninguno deje de
ser conforme. Consulta
[ADR-0021](/es/spec/decisions/0021-implementation-defined-boundaries)
para el catálogo completo.

| Área | Posición de XTL 0.1 |
|---|---|
| Modelo de memoria / streaming | definido por la implementación |
| Forma de API síncrona vs. asíncrona | definido por la implementación |
| Fórmula nativa de Excel en la fuente | requerido: leer el resultado cacheado, error si falta |
| Fórmula nativa de Excel en la plantilla | definido por la implementación (típicamente paso directo) |
| Formatos `TEXT()` fuera de la tabla central | extensión definida por la implementación |
| Preservación de celdas combinadas al expandir filas | requerido (arriba/abajo); definido por la implementación dentro del bloque de datos |
| Claves personalizadas en `__config__` | requerido: accesibles vía `{{ __config__[key] }}` |
| Fuente vacía (cero filas) | salida definida por la implementación, sin error |
| Colisión de nombre de hoja tras saneamiento | definido por la implementación |
| Bloque de plantilla vacío `{{   }}` | error |
| Hojas en la entrada que no son de plantilla ni reservadas | definido por la implementación (típicamente paso directo) |

## Superficies diferidas

Estas NO están en 1.0. El ADR de aplazamiento explica por qué y qué
debe abordar (**MUST**) una especificación futura antes de añadir la
superficie.

| Superficie | Estado | ADR de aplazamiento |
|---|---|---|
| Aritmética de fechas (`EOMONTH`, `EDATE`, `DATEDIF`, …) | diferido | ADR-0019 |
| Colación sensible a la configuración regional | diferido | ADR-0020 |
| Multi-`@join`, left-join, coincidencias multi-fila | diferido | ADR-0014 (sección fuera de alcance) |
| Comodines / aproximado / inverso en XLOOKUP | diferido | ADR-0013 (sección fuera de alcance) |
| Diferencias entre escritores en Etapa 2 (atributos por defecto, mayúsculas/minúsculas en hex de color, prefijos de espacio de nombres) | diferido | enmienda de ADR-0006 |
