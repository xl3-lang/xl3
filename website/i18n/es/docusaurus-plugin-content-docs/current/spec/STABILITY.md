# Política de estabilidad de XTL

## Estado actual

XTL está en la versión **0.1**. La implementación de referencia se
publica como `@jinyoung4478/xl3@0.1.0` en npm. El corte 1.0 se ha
aplazado deliberadamente hasta acumular validación externa: como
mínimo, un port en un segundo lenguaje que pase el corpus de
conformidad y un adoptante en producción. Hasta entonces, los cambios
incompatibles son posibles entre versiones menores 0.x y deberían
(**SHOULD**) documentarse en los ADR afectados.

El contrato que congelará 1.0 ya está redactado (consulta "Camino
hacia 1.0" más abajo); el aplazamiento se refiere al nivel de señal
externa requerido para comprometerse, no a que la especificación esté
incompleta.

## Durante 0.x

- Los cambios incompatibles de la especificación se documentan en los ADR afectados y se reflejan en el corpus de conformidad antes de la siguiente versión menor.
- La implementación de referencia (`xl3` en npm) sigue SemVer para su propia API; las rupturas de especificación incrementan la versión menor de la especificación.
- Las implementaciones deberían declarar a qué versión de la especificación apuntan (por ejemplo, `XTL 0.2 partial`, `XTL 0.3 full`).

## En 1.0

- La especificación se congela y solo admite evolución compatible hacia atrás.
- Los cambios incompatibles de la especificación requieren XTL 2.0 con discusión pública y una guía de migración.
- La implementación de referencia sigue SemVer estrictamente.

## Camino hacia 1.0

El corte 1.0 cierra el primer contrato de portabilidad de XTL. La
intención es que cualquier implementación conforme produzca una salida
idéntica (Etapa 1) y un OOXML canónico idéntico (Etapa 2) para el
corpus de fixtures congelado, en cualquier zona horaria del host,
configuración regional u orden de bytes.

### Superficie pública de la API (implementación de referencia xl3)

La implementación de referencia en TypeScript congela los siguientes
13 exports de tiempo de ejecución en 1.0. Añadir un export nuevo es
compatible hacia atrás; eliminar o renombrar cualquiera de ellos es un
cambio reservado a 2.0.

**Puntos de entrada de conversión**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**Helpers de bajo nivel**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook, configVars?) → InputSpec[]` (el
  argumento opcional `configVars` se añadió en 0.6.0 según ADR-0050;
  las llamadas con un solo argumento siguen siendo válidas)
- `batchMatch(...)` — helper de coincidencia por patrón de archivos
- `toTemplateModel(parsed) → TemplateModel`

**Helpers de error (ADR-0015)**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**Re-exports de tipos estables** — congelados en 1.0:
`TemplateMeta`, `TemplateModel`, `OutputFile`, `PreviewResult`,
`PreviewSource`, `PreviewFile`, `PreviewSheet`, `ConvertOptions`,
`InputSpec`, `InputType`, `SourceSpec`, `XtlError`, `XtlErrorCode`,
`XtlWarning`, `XtlWarningCode`.

**Re-exports de tipos experimentales** (ROADMAP G22) — exportados
para herramientas, pero su forma puede (**MAY**) cambiar entre
versiones menores: `ParsedTemplate`, `SheetTemplate`,
`TemplateVariable`, `DataBlock`, `Directive`, `FilterDirective`,
`FilterOp`, `SortDirective`, `TopDirective`, `RepeatDirective`,
`SourceDirective`, `JoinDirective`.

Cada tipo experimental lleva una etiqueta JSDoc `@experimental`. Los
hosts que sostengan uno de estos objetos deberían (**SHOULD**)
distribuir según `kind` (para directivas) o tratar la forma como
opaca, y deberían (**SHOULD**) fijar una versión menor específica de
xl3 si dependen de un conjunto particular de campos. La alternativa
serializable y de evolución más lenta para la mayoría de las
necesidades de herramientas es `TemplateModel` (devuelto por
`analyzeModel`).

La prueba de snapshot en `src/__tests__/api-surface.test.ts` fija la
lista de tiempo de ejecución y hace fallar CI ante cambios silenciosos.
Los exports nuevos requieren actualizar deliberadamente el snapshot Y
una entrada en el CHANGELOG.

### Qué congela 1.0

El área cubierta por los siguientes ADR forma parte del contrato 1.0.
Los cambios incompatibles requieren un corte XTL 2.0.

- ADR-0001 — semántica UTC de `TODAY()`
- ADR-0002 — saneamiento de nombres de archivo de salida
- ADR-0003 — coerción basada en numFmt
- ADR-0005 — protocolo dinámico de aserciones de conformidad
- ADR-0006 — comparación canónica OOXML de Etapa 2 (reglas 1-8 + la
  enmienda que lista los puntos pendientes)
- ADR-0007 — predicado de valor vacío
- ADR-0008 — reglas de veracidad (truthiness)
- ADR-0009 + ADR-0017 — algoritmo de comparación y modelo de valor
  de fuente (se leen juntos como un único contrato)
- ADR-0010 + ADR-0011 — entradas en tiempo de ejecución y nomenclatura de hojas reservadas
- ADR-0012 — modelo de datos multi-fuente
- ADR-0013 — búsqueda XLOOKUP entre fuentes
- ADR-0014 — emparejamiento a nivel de bloque con `@join` (inner
  join único, primer-match determinista)
- ADR-0015 — reporte estructurado de errores (códigos `xl3/...` +
  mensajes de conformidad en inglés)
- ADR-0016 — ordenamiento y estabilidad de orden
- ADR-0033 — cabeceras de fuente con celdas combinadas
- ADR-0035 — broadcast de celdas combinadas en filas de datos
- ADR-0036 — matriz de preservación de características de plantilla
- ADR-0038 — directivas `@group` + `@subtotal` (emisión
  intercalada de subtotales)
- ADR-0039 — salida de celda `HYPERLINK`
- ADR-0040 — enmienda a la matriz de preservación (nivel de esquema
  entregado; CF/DV de rango PE pendiente para 0.6.1)
- ADR-0041 — contrato de texto de celda multi-línea
- ADR-0044 — lote de funciones (UPPER, LOWER, TRIM, IFERROR, IFS, DATE)
- ADR-0046 — preservación de fórmulas de celda (contrato de elemento OOXML)
- ADR-0047 — `ISBLANK` como alias de `IFEMPTY`
- ADR-0050 — `default`/`label`/`description`/`options` de `__inputs__`
  como plantillas XTL
- ADR-0051 — frontera del delimitador de bloque `{{ ... }}` +
  detección de literales no balanceados
- ADR-0052 — clasificación de celda de expresión única vs. texto
  mixto (trim y coincidencia anclada; bloques adyacentes siempre
  texto mixto)
- ADR-0053 — propagación de centinelas de error de Excel en texto mixto
- ADR-0054 — nombres simples en celdas / patrones de archivo / hoja
  (resolución abreviada + `xl3/expression/unknown-name`)
- ADR-0055 — gramática de entero positivo de `@top` / `@repeat right`
- ADR-0056 — política de lectura de `__config__[system-key]`
- ADR-0057 — rechazo de `__lists__[name]` fuera de `@filter in/!in`
- ADR-0058 — composición de fila de `@subtotal` (binding de nivel en la misma fila)
- ADR-0059 — forma del argumento de agregación (solo referencia a columna)
- ADR-0060 — reglas de argumento valor / fallback de `XLOOKUP` (fallback perezoso)
- ADR-0061 — desambiguación léxica entre nombre de fuente y nombre
  de función (preserva el paso directo de extensiones de ADR-0024)
- ADR-0062 — semántica de `default = ""` en `__inputs__`
- ADR-0063 — reglas de división por pipe en `options` de `__inputs__`
- ADR-0064 — alcance de la coerción cadena→número (notación
  científica aceptada; hexadecimal / binario / octal rechazados)
- ADR-0065 — forma explícita de `@source default` + sensibilidad a
  mayúsculas/minúsculas en nombres de fuente
- ADR-0021 (enmienda de orden de grupo) — el orden de grupo bajo un
  `@sort` que no coincide es definido por la implementación
- ADR-0041 (enmienda de cabecera) — normalización de saltos de línea en celdas de cabecera

ADR-0043 y ADR-0048 son **normativos de proceso**: vinculan a futuros
autores de ADR pero no al contrato de tiempo de ejecución. ADR-0034 y
ADR-0049 son informativos. ADR-0004 es informativo (auditoría de
acoplamiento con la implementación de referencia). ADR-0037, ADR-0042
y ADR-0045 están rechazados (el rechazo ES el contrato).

### Qué NO incluye 1.0

Los siguientes elementos están diferidos intencionadamente. Añadirlos
es compatible hacia atrás y no requiere una nueva versión mayor de la
especificación.

- Múltiples directivas `@join` en un solo bloque, semántica de
  `@join … left`, coincidencias multi-fila en joins (lista
  explícita de fuera de alcance de ADR-0014).
- Modos de comodín, aproximado y búsqueda inversa en XLOOKUP
  (lista explícita de fuera de alcance de ADR-0013).
- Colación de cadenas sensible a la configuración regional. La
  ordenación usa el orden de puntos de código Unicode; los hosts
  que necesiten colación regional pre-ordenan aguas arriba.
- Funciones aritméticas de fecha/datetime (sin `EOMONTH`,
  `EDATE`, `DATEDIF`, etc.).
- Canonicalización entre escritores para los puntos pendientes en
  la enmienda de ADR-0006 (equivalencia de atributos por defecto,
  mayúsculas/minúsculas en hex de color, bindings de prefijos de
  espacio de nombres).
- Un formato normativo de cable para entradas, fuentes o salidas
  más allá de la superficie de API del host en ADR-0010 /
  ADR-0012.

### Línea base de conformidad

El corpus de conformidad de 1.0 es la unión de los fixtures
etiquetados con `spec_version: "0.1"` más cualquiera añadido antes del
corte 1.0. El corpus debe pasar:

1. Comparación de valor de celda en Etapa 1.
2. Comparación canónica OOXML de Etapa 2 para los fixtures que
   declaren `comparison_stage: 2`.
3. Etapa 1 bajo al menos tres zonas horarias (`UTC`,
   `America/New_York`, `Asia/Seoul`): el flujo de CI del repo de
   referencia ejecuta esta matriz; los ports deberían (**SHOULD**)
   hacer lo mismo.

Una implementación que reclame 1.0 debe (**MUST**) reportar su
ejecución de conformidad contra este corpus y no debe (**MUST NOT**)
saltarse fixtures salvo aquellos declarados en una etapa de
comparación superior a la que soporta su runner.

## Núcleo vs. extensiones

La especificación distingue:

- **Núcleo (Core)**: las características del lenguaje requeridas para conformidad. Se resumen en [`README.md`](/es/spec) y se definen en [`language.md`](/es/spec/language) y [`evaluation.md`](/es/spec/evaluation). Los cambios incompatibles aquí son eventos de versión de la especificación.
- **Extensiones**: añadidos específicos de la implementación o del dominio. Pueden variar entre implementaciones. Se documentan en los README de la implementación, no en la especificación.

Las implementaciones pueden (**MAY**) añadir extensiones, pero no
deben (**MUST NOT**) cambiar silenciosamente la semántica del núcleo.

Por ejemplo, las implementaciones pueden admitir formatos `TEXT()`
adicionales más allá de la tabla central de XTL 0.1. Esos formatos son
extensiones: las plantillas portables no deberían depender de ellos,
y los fixtures de conformidad no requieren una salida idéntica para
ellos.

## Versionado del corpus de conformidad

La versión del corpus de conformidad sigue la versión de la
especificación. Un fixture añadido en la especificación 0.3 se etiqueta
de forma acorde; las implementaciones declaran qué fixtures pasan y,
en consecuencia, a qué versión de la especificación se conforman.

## Política de deprecación (post-1.0)

Cuando una característica vaya a ser eliminada en una versión mayor
futura:

1. La característica se marca como **deprecada** en la especificación durante al menos una versión menor antes de su eliminación.
2. Los fixtures de conformidad que usen la característica deprecada reciben una etiqueta `deprecated`.
3. Se anima a las implementaciones a emitir advertencias cuando se use la característica deprecada.
4. La eliminación ocurre en la siguiente versión mayor (por ejemplo, deprecada en 1.3 → eliminada en 2.0).
