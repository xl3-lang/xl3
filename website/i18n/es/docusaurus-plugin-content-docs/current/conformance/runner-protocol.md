# Protocolo del ejecutor de conformidad

Define el contrato entre el corpus de conformidad y cualquier implementación de XTL que quiera reclamar conformidad.

## Qué es un ejecutor

Un **ejecutor de conformidad** es un programa pequeño que:

1. Itera sobre los fixtures en `conformance/fixtures/`
2. Invoca la implementación bajo prueba en cada `template.xlsx` + `data.xlsx` del fixture
3. Compara la salida de la implementación con el `expected.xlsx` del fixture (o con el directorio `expected/`)
4. Reporta pass / fail / skip por fixture en un formato estándar

Cada implementación provee su propio ejecutor (ya que la invocación es específica del lenguaje), pero todos los ejecutores producen salidas comparables.

## Carga de fixtures

Un ejecutor descubre los fixtures enumerando los subdirectorios de `conformance/fixtures/`. Cada subdirectorio se llama `<NNN>-<slug>/` (p. ej., `001-basic-substitution`).

Para cada fixture, el ejecutor lee:

- `template.xlsx` — plantilla de entrada
- `data.xlsx` — datos fuente de entrada
- `expected.xlsx` (caso de salida única) **o** directorio `expected/` con archivos `.xlsx` (caso de grupo multi-archivo, incluyendo casos de cero salidas)
- `meta.yaml` — metadatos del fixture

Los fixtures estáticos que esperan cero archivos de salida usan un directorio
`expected/` vacío.

Los fixtures de error omiten `expected.xlsx` y `expected/`. Declaran
`expected_error` en `meta.yaml`; el resultado esperado es que la implementación
reporte un error cuyo mensaje contenga el texto declarado.

Los fixtures dinámicos omiten `expected.xlsx` y `expected/`. Declaran
`expected_dynamic` en `meta.yaml`; el resultado esperado lo calcula el ejecutor
a partir del timestamp de inicio del ejecutor y las reglas de aserción
declaradas. Los fixtures dinámicos están reservados para comportamiento que es
explícitamente dependiente del tiempo en la especificación, como `TODAY()`.

## Campos requeridos en `meta.yaml`

```yaml
description: string         # descripción humana de una línea
spec_section: string        # la sección de la especificación que este fixture ejercita
spec_version: string        # versión mínima de XTL (p. ej., "0.1")
tags: [string, ...]         # tags de filtro (p. ej., [substitution, repeat, aggregate])
```

`tags` es una conveniencia del lado del fixture para el flag CLI
`--filter=<tag>`. Los valores de tag NO son parte del contrato de
conformidad — los ejecutores **MUST** tratarlos como strings opacas y
**SHOULD NOT** rechazar un fixture porque su conjunto de tags difiera
del de otro fixture. El corpus de referencia usa tokens en minúscula
separados por guión, pero no impone una taxonomía canónica.

Campos opcionales:

```yaml
verified_by: [hand | excel-formulas | manual-script | reference-impl]
expected_warnings: [string, ...]   # advertencias que la implementación debe emitir
expected_error: string             # substring esperado del mensaje de error; no se requiere salida esperada
expected_error_code: string        # código de error estable ADR-0015 opcional (p. ej. "xl3/source/undeclared")
expected_dynamic: string           # tipo de aserción dinámica; no se requiere salida esperada
comparison_stage: 1 | 2            # etapa de comparación mínima para fixtures de salida estática; el valor por defecto es 1
skip_reason: string                # si el fixture está roto actualmente
inputs:                            # entradas en tiempo de ejecución provistas por el host (ADR-0010)
  - name: region
    value: Seoul
```

El bloque `inputs` lista pares nombre/valor que el ejecutor pasa a
la implementación como entradas de tiempo de ejecución (según la hoja
`_inputs` de ADR-0010). Los ejecutores **MUST** reenviar estos valores
al punto de entrada de conversión de la implementación. Las plantillas
sin hoja `_inputs` ignoran el campo.

Metadatos de control de etapa:

- `comparison_stage` aplica solo a fixtures de salida estática. Toma por defecto
  `1`. Usa `2` solo cuando el fixture verifique contenido del libro que la
  etapa 1 no puede observar, como estilos, combinaciones, partes del paquete o
  medios binarios.
- Los fixtures `expected_error` y los fixtures `expected_dynamic` no usan etapas
  de comparación del libro para pass/fail. Un ejecutor sigue reportando la etapa
  de ejecución activa, pero estos fixtures mantienen sus propias reglas de
  aserción de error o dinámica.
- `expected_dynamic` requiere `dynamic_cells` para el tipo de aserción
  actualmente definido `utc_today`. Los fixtures de salida estática y de error
  omiten `dynamic_cells`.

Un ejecutor **MUST** marcar un fixture `expected_error` como:

- `pass` cuando la implementación reporta un error que contiene `expected_error`
- `fail` cuando la implementación tiene éxito
- `fail` cuando la implementación reporta un error diferente

`expected_error` y `expected_dynamic` son mutuamente exclusivos.

## Aserciones dinámicas

Las aserciones dinámicas hacen testeable el comportamiento en tiempo de render
sin comprometer un `expected.xlsx` obsoleto. Un ejecutor **MUST** capturar un
único timestamp de inicio del ejecutor antes de ejecutar el primer fixture y
usar ese timestamp para cada fixture dinámico de la ejecución. Esto evita
diferencias por el borde de medianoche entre fixtures dentro del mismo reporte.

XTL 0.1 define un único tipo de aserción dinámica:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

Para `utc_today`, el valor esperado para cada celda listada es la fecha
calendario UTC del timestamp de inicio del ejecutor, formateada con el formato
de fecha `TEXT()` de XTL listado. La salida de la implementación **MUST**
contener el valor string esperado en cada coordenada hoja/celda listada.

Un ejecutor **MUST** marcar un fixture `expected_dynamic` como:

- `pass` cuando la implementación tiene éxito y cada celda dinámica listada coincide
- `fail` cuando la implementación reporta un error
- `fail` cuando cualquier celda dinámica listada difiere del valor esperado calculado

Los ejecutores que no implementen un tipo `expected_dynamic` declarado **MUST**
marcar el fixture como `skip` e incluir una razón. **MUST NOT** reportarlo como
pasado.

## Etapas de comparación

El protocolo de conformidad tiene dos etapas de comparación:

- **Etapa 1: comparación de valores de celda.** El ejecutor compara nombres de
  hoja y valores de celda no auxiliares tras cargar los archivos `.xlsx` por
  una librería de hojas de cálculo. Esta etapa ignora intencionalmente estilos,
  combinaciones, page setup, medios embebidos, fórmulas más allá de los valores
  cacheados y la estructura del paquete. Es suficiente para el corpus de
  arranque de XTL 0.1 mientras se especifica e implementa la comparación
  canónica de OOXML.
- **Etapa 2: comparación canónica de OOXML.** El ejecutor compara los archivos
  `.xlsx` generados tras canonicalizar sus paquetes OOXML. Esta es la meta para
  la conformidad completa de salida estática porque puede detectar regresiones
  de layout, estilo, combinación, estructura de hoja y paquete que la etapa 1
  no puede ver.

Los fixtures de error y los fixtures dinámicos no son comparaciones de salida
de libro. Mantienen sus reglas de pass/fail de `expected_error` y
`expected_dynamic` independientemente de la etapa de comparación.

Los reportes **SHOULD** identificar la etapa de comparación usada en cada
ejecución. Una implementación **MUST NOT** reclamar conformidad de etapa 2 a
partir de una ejecución solo de etapa 1. Los fixtures de salida estática
**MAY** declarar `comparison_stage` en `meta.yaml`. Un ejecutor **MUST**
saltarse un fixture cuya etapa de comparación declarada sea mayor que la
etapa activa del ejecutor.

## Comparación de salida en etapa 2

La comparación se realiza sobre OOXML **canonicalizado**. Las reglas mínimas de canonicalización:

1. Los archivos dentro del zip **MUST** compararse por contenido, no por
   metadatos del zip (timestamps, compresión, orden de entradas o nivel de
   compresión).
2. Los nombres de partes del paquete **MUST** coincidir tras la canonicalización.
   Partes del libro faltantes o extra son diferencias salvo que un ADR posterior
   marque la parte como volátil.
3. Los archivos XML **MUST** compararse tras parsear y re-serializar con
   declaraciones de namespace, orden de atributos, estilo de comillas y
   representación de elementos vacíos deterministas.
4. El orden de elementos XML **MUST** preservarse salvo que un ADR posterior
   marque explícitamente una colección de elementos específica como no ordenada.
   Los archivos de relaciones son datos ordenados del paquete, no conjuntos,
   hasta que exista tal regla.
5. Los siguientes campos se eliminan antes de comparar (reflejan metadatos del generador, no contenido):
   - `cp:lastModifiedBy`, `dc:creator`, `dcterms:created`, `dcterms:modified`
   - Cualquier atributo `calcId` de `<calcPr>` (versión del motor de cálculo de Excel)
   - IDs de hoja generados y nombres de archivo de parte de hoja cuando pueden
     resolverse a través de las relaciones del libro y los nombres de hoja
   - Valores de page setup por defecto que ExcelJS puede añadir u omitir (`copies="1"`,
     `firstPageNumber="1"`, `useFirstPageNumber="1"`)
6. El whitespace insignificante dentro de runs de texto se preserva (puede ser
   semánticamente significativo).
7. Los atributos `r` (reference) de celda **MUST** coincidir exactamente; el orden
   de celdas dentro de `<row>` **MUST** coincidir.
8. Las partes binarias del paquete, como imágenes, **MUST** compararse por bytes exactos.

El ejecutor de referencia JS incluye un canonicalizador de etapa 2 para la
comparación de conformidad. Su alcance está intencionalmente acotado al OOXML
producido por los fixtures XTL soportados más las reglas de normalización
arriba; no es una librería de canonicalización XML de propósito general. En
particular, no reclama soporte completo de XML C14N, procesamiento de DTD/
entidades, reescritura semántica de namespaces, ni reglas de colección no
ordenada específicas de aplicación más allá de las explícitamente listadas
aquí. Los fixtures que necesiten reglas adicionales de equivalencia OOXML
deberían actualizar primero este protocolo.

### Huecos conocidos de canonicalización

Estos casos NO son normalizados por el canonicalizador actual. Se
tratan como diferencias si llegan a aparecer. Consulta la enmienda de
[ADR-0006](../spec/decisions/0006-stage-2-ooxml-conformance.md) para la justificación.

- **Equivalencia de atributos por defecto.** Un atributo booleano que un
  default de OOXML especifica, omitido vs. emitido como el valor por
  defecto (p. ej., `applyFont="0"`), se trata como una diferencia.
- **Mayúsculas/minúsculas en colores hex.** `rgb="FF000000"` y
  `rgb="ff000000"` se comparan como strings diferentes.
- **Bindings de prefijo de namespace.** Diferentes prefijos enlazados al
  mismo URI de namespace no se unifican.

Cuando un fixture cross-writer expone uno de estos huecos como una
diferencia **genuinamente volátil** (no una diferencia de contenido
disfrazada), el protocolo y el canonicalizador de referencia deben
extenderse juntos. Las implementaciones **MUST NOT** relajar estas
reglas localmente en silencio.

## Convenciones del CLI del ejecutor

Las implementaciones deberían exponer un ejecutor con esta interfaz mínima:

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]
```

Las implementaciones que provean un canonicalizador de etapa 2 **SHOULD** también
exponer un comando de depuración que imprima el contenido canónico del paquete
en orden determinista de partes:

```
<runner> canonicalize <input.xlsx> [--part=<canonical-part-name>]
```

Cuando se omite `--part`, el comando **SHOULD** emitir un objeto JSON indexado
por nombre canónico de parte del paquete. Cuando `--part` está presente,
**SHOULD** emitir solo el contenido de esa parte canónica.

Formato del reporte JSON:

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
  "comparison_stage": 1,
  "results": [
    {
      "fixture": "001-basic-substitution",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "fixture": "007-aggregate-sum",
      "status": "fail",
      "duration_ms": 8,
      "diff": "cell B5: expected 1234, got 1234.0"
    }
  ],
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 1,
    "skipped": 1
  }
}
```

## Reporte de conformidad

Una implementación reporta su nivel de conformidad enlazando a una ejecución pública de conformidad. La forma esperada:

```
xl3-py 0.2.0 — XTL 0.1 conformance: 38/42 (passes filter, repeat, aggregate; fails image-clone, _config-pattern-match, two date-edge cases)
```

El [`IMPLEMENTATIONS.md`](../IMPLEMENTATIONS.md) del repo lista las implementaciones conocidas y sus niveles de conformidad.
