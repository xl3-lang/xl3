# Hoja de ruta

Lo que tiene que pasar para **XTL 1.0** (especificación) y **xl3 1.0**
(implementación de referencia).

La versión actual es **0.7.0** (npm) y apunta a **XTL 0.1 (borrador)**.
Durante la rama 0.x todavía son posibles los cambios incompatibles. El
corte 1.0 depende de los criterios que aparecen abajo, no de una fecha
de calendario.

> La **planificación profunda de versiones** vive en
> [`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
> — análisis de huecos, frontera filosófica (xl3 ≠ JXLS) y plan paso a
> paso por versión. Este documento es el resumen ejecutivo; el blueprint
> es la justificación.
>
> **La tabla de abajo es la única fuente de verdad para los criterios de
> 1.0.** Si este archivo y el blueprint entran en conflicto, manda esta
> tabla; el blueprint se actualiza para encajar.

## Qué significa 1.0 para xl3

El objetivo de 1.0 es **confianza legible para personas operativas**:
una especificación que no se mueva, una implementación de referencia que
no sorprenda y una superficie lo bastante pequeña como para que una
persona operadora pueda revisar una plantilla sin leer código. **No** se
trata de paridad de funcionalidades con JXLS — xl3 envía
intencionalmente una superficie más pequeña (ADR-0043 + ADR-0048). La
audiencia objetivo son los **equipos de operaciones coreanos que
gestionan muchos formatos de factura específicos por cliente**
(거래명세서, 정산서, 발주서); el motor generaliza más allá de ese
nicho, pero el nicho es la cuña inicial.

## Tabla de criterios para 1.0 (única fuente de verdad)

Cada criterio tiene un responsable, el artefacto que lo cierra, la
condición de aprobación/rechazo, una alternativa si el criterio no se
puede alcanzar y el hito objetivo. El plan paso a paso por versión más
abajo referencia estos criterios por ID.

| ID | Criterio | Responsable | Artefacto | Condición de aprobación | Alternativa | Objetivo |
|----|----------|-------------|-----------|-------------------------|-------------|----------|
| G1 | Corpus de conformidad ≥ 140 | mantenedor | `conformance/fixtures/` | `ls conformance/fixtures/ \| wc -l` ≥ 140 | — | 0.7.1 (139 hoy; los ADR de 0.7.0 reservaron los números 141–187) |
| G2 | Canonicalización OOXML de Stage 2 especificada | mantenedor | ADR-0006 + canonicalizador en src/ | cubierto por los fixtures 024-027, 093 + enmienda a ADR-0006 | — | HECHO |
| G3 | Catálogo de códigos de error congelado | mantenedor | snapshot de `src/__tests__/error-codes.test.ts` | el snapshot del catálogo no cambia durante 30 días | — | 0.9-rc (reloj reiniciado el 2026-05-22 por los 4 códigos nuevos de 0.7.0) |
| G4 | Frontera con JXLS publicada | mantenedor | ADR-0048 | el archivo existe y referencia PORTERS_GUIDE | — | HECHO |
| G5 | ADR de implementación diferida aterrizados | mantenedor | impl de ADR-0038 ✅ (2026-05-18) + impl PE de ADR-0040 | la parte de ADR-0038 ya enviada (fixtures 132-135); la extensión de rango CF/DV de ADR-0040 sigue pendiente | — | 0.6 (parcial) / 0.7.1 |
| G6 | Superficie de API pública congelada | mantenedor | snapshot de `src/__tests__/api-surface.test.ts` | el snapshot no cambia durante 30 días | — | 0.9-rc |
| G7 | Ejemplos JSDoc en exports `@stable` | mantenedor | salida de TypeDoc | cada símbolo `@stable` tiene un bloque `@example` | — | 0.8 |
| G8 | Rendimiento caracterizado | mantenedor | `scripts/BENCH.md` | matriz 1k/10k/100k filas × 5/10/20 columnas + techo de memoria + desglose parse/eval/write publicados | — | 0.7.1 |
| G9 | Fixtures de regresión de rendimiento | mantenedor | corpus de conformidad | ≥ 2 fixtures grandes con aserción basada en ratio | — | 0.7.1 |
| G10 | Prueba de humo multinavegador | mantenedor | `ci.yml` | Safari + Firefox bundle-load + 1 `convert()` por ejecución | — | 0.7.1 |
| G11 | Stage 2 en CI | mantenedor | `ci.yml` | `npm run conformance:stage2` se ejecuta en cada PR | — | 0.7.1 |
| G12 | Comportamiento indefinido fijado (pivot/sparkline/ListObject/salto de página) | mantenedor | fixtures de conformidad + ADR por elemento | cada uno: un fixture que fija el comportamiento actual O un ADR que lo difiere explícitamente a 1.x | diferir a 1.1 con ADR | 0.7.1 / 0.8 |
| G13 | Validación con segunda implementación de idioma | externo (xl3-py) | `conformance/reports/*.json` | xl3-py pasa ≥ 80% de Stage 1 O ≥ 80% de Stage 2, O esqueleto al 50% documentado en otro lenguaje (Rust/Go/Java) dentro de los 12 meses posteriores al cierre del resto de criterios | aceptar 1.0 con una sola implementación mediante un ADR público que enmiende GOVERNANCE | 0.7.x–0.8.x |
| G14 | ADR de contribuidor externo | externo | `spec/decisions/NNNN-*.md` | ≥ 1 ADR con un no-mantenedor como Autor (≥ 60% de las secciones Context/Decision por número de líneas) | plazo de 18 meses, luego: ≥ 2 recetas del cookbook escritas externamente O ≥ 5 fixtures de conformidad escritos externamente | 0.8 |
| G15 | Referencia en producción | externo (con ayuda del mantenedor) | fila "Production users" de `IMPLEMENTATIONS.md` | ≥ 1 usuario nombrado, satisfecho por (a) una empresa externa con permiso para aparecer en la lista, O (b) el propio empleador del mantenedor ejecutando xl3 en producción programada con un caso de estudio público | — | 0.8 |
| G16 | Ampliación del conjunto de mantenedores | mantenedor | `GOVERNANCE.md` | ≥ 2 personas con derechos de aceptar/rechazar ADR y PR de implementación | aceptación explícita de la forma de gobernanza 1.0 con un único mantenedor mediante una enmienda a GOVERNANCE | 0.8 |
| G17 | i18n del cookbook coreano completo | mantenedor | `website/i18n/ko/.../guides/` | todas las recetas del cookbook tienen traducción al coreano | — | HECHO (0.6) |
| G18 | Caso de uso productivo en el README | mantenedor | `README.md` | sustituye el estado "alfa" por una referencia concreta en producción (ligado a G15) | — | 1.0 (con G15) |
| G19 | Guía de migración 0.x → 1.0 | mantenedor | `docs/migration-0.x-to-1.0.md` | documenta cada cambio de comportamiento o confirma que todo es aditivo | rebajar a una nota en el historial de cambios si se confirma que todo es aditivo | 0.8 |
| G20 | SECURITY.md + modelo de amenazas | mantenedor | `SECURITY.md` + enmienda a la especificación | documenta la postura ante zip-bomb / libros sobredimensionados / ejecución de fórmulas + API de límites | — | 0.7.1 |
| G21 | Límites duros documentados (sin streaming hasta 1.1) | mantenedor | spec/evaluation.md | valores de límite duro de filas / memoria + API `AbortSignal` documentada | — | 0.7.1 |
| G22 | Superficie de API — tipos de modelo internos separados | mantenedor | exports de `src/index.ts` + STABILITY.md | solo `convert`/`preview`/`analyze` + interfaces estables marcadas `@stable`; tipos de modelo/parser marcados `@experimental` o movidos a `xl3/internal` | — | HECHO (0.6) |
| G23 | Maduración del RC | mantenedor | tags de git | RC publicada; ≥ 21 días de maduración (ampliado desde 7 días tras feedback de revisión); 0 incidencias críticas | — | 0.9-rc |
| G24 | Checklist post "trimestre estable" | mantenedor | calendario de releases | ventana de 90 días después de que el ÚLTIMO criterio de arriba marque ✅; ningún cambio incompatible de spec/API/código de error durante la ventana | un cambio incompatible → reinicia el reloj | entre el último tick de criterio y el corte 1.0 |

### Definiciones (verificables)

- **Contribuidor externo (G14):** no está en el conjunto de mantenedores
  de `GOVERNANCE.md` Y no aparece en el historial `Co-authored-by` de
  commits de ADR ya fusionados en el momento de abrir el PR. Las
  ediciones de paso para corregir erratas no cuentan; debe figurar como
  Autor en el front-matter del ADR; escribió ≥ 60% de las secciones
  Context/Decision medido por número de líneas.
- **Cambio incompatible (G24, G23):** cualquier cambio en (a) el
  snapshot de la superficie de API pública, (b) el catálogo de códigos
  de error (renombre/eliminación/reasignación), (c) un cambio de estado
  de un ADR de `accepted` → `rejected` o un giro que contradice su
  estado. Las versiones de parche y los ADR aditivos NO reinician el
  reloj del trimestre.
- **Bugfix crítico (excepción para el RC de G23):** (a) pérdida
  silenciosa de datos en `convert()`, (b) inconsistencia en el catálogo
  de códigos de error entre la documentación y el runtime, O (c) un
  MUST de un ADR `accepted` que no se puede implementar tal y como está
  escrito. El mantenedor cita cuál de (a)/(b)/(c) aplica en el PR.
- **Test de pérdida de datos (forma verificable de G24):** el corpus
  tiene un grupo de fixtures dedicado `data-loss/` (≥ 8 fixtures) que
  ejercita los caminos de stringify silencioso, pérdida de numFmt,
  reescritura de fórmulas y round-trip de fechas; todos pasan en la
  implementación de referencia.
- **Inicio del reloj del trimestre (G24 vs G23):** el trimestre de 90
  días empieza el día en que el ÚLTIMO criterio marca ✅. La publicación
  del RC NO inicia el reloj; el reloj tiene que haber arrancado ANTES de
  la publicación del RC. Si ocurre un cambio incompatible durante la
  maduración del RC, tanto la maduración (G23) como el trimestre (G24)
  se reinician.

## Plan paso a paso por versión

Basado en criterios, no en fechas. Las estimaciones de calendario se han
eliminado — cada hito se cierra cuando se cierran los criterios que
tiene listados.

### 0.6.0 — Implementación diferida, alcance reducido

Tema: cerrar limpiamente el criterio de implementación diferida con
mayor impacto.

Criterios cerrados: **G5** (solo la implementación de
`@group`/`@subtotal` — el resto de ADR-0040 PE se mueve a 0.6.1),
**G17** (faltaban 16 de 17 traducciones del cookbook coreano), **G22**
(limpieza de la superficie de API antes de que `@group` exponga nuevos
tipos internos).

El plan anterior de "una sola 0.6.0 con todo" tenía un alcance
demasiado ambicioso según la revisión de viabilidad de ingeniería. La
implementación de ADR-0038 por sí sola es una inserción completa en el
pipeline (nueva directiva, máquina de estados de límites de grupo,
partición de pase de transformación, reescritura del renderizador,
evaluación de agregados con ámbito de grupo). Partir 0.6.0 mantiene el
hito enviable.

### 0.6.1 — Resto de implementación diferida (planificada, todavía no enviada)

Criterios cerrados: completar **G5** (ADR-0040 PE: extensión `sqref`
para CF/DV), fixtures de comportamiento de pivot/salto de página
avanzando hacia **G12**.

Estado al lanzar 0.7.0: este hito quedó desplazado por el lote de
auditoría de la especificación (0.7.0). El trabajo de G5/G12 se
incorpora a 0.7.1.

### 0.7.0 — Lote de auditoría de la especificación (enviado el 2026-05-22)

Tema: cerrar 17 huecos de conflicto sintáctico detectados por una
auditoría profunda del lexer, la clasificación de celdas, la
composición de directivas, los argumentos de agregados y la semántica
de hojas reservadas. No estaba en la tabla de criterios original; el
trabajo de rendimiento/CI/límites originalmente etiquetado como 0.7.0
se mueve a **0.7.1**.

Artefactos enviados:

- 15 ADR nuevos (0051–0065) + enmiendas a ADR-0021 (entrada del
  catálogo para `group-order`) y ADR-0041 (normalización
  multilínea de celdas de cabecera).
- 4 códigos de error nuevos —
  `xl3/parser/unbalanced-literal`, `xl3/lists/invalid-use`,
  `xl3/eval/bad-aggregate-arg`, `xl3/expression/unknown-name`.
- Adiciones gramaticales: `positive_integer`,
  `group_directive`, `subtotal_directive`, `aggregate_call`, nota
  de desambiguación léxica.
- Refuerzo de `src/directive-parser.ts` para enteros con cero a
  la izquierda.
- Revisión paralela en dos pasadas (claude-general + codex);
  todos los hallazgos CRITICAL/HIGH cerrados antes del tag.

Impacto en los criterios:

- **G1** — 139 fixtures hoy. Los ADR de 0.7.0 reservaron los
  números de fixture **141–187**; la implementación está
  pendiente. G1 cierra cuando esos fixtures aterricen en 0.7.1.
- **G3** — el reloj de 30 días del catálogo de códigos de error
  **se reinició** el 2026-05-22 por los 4 códigos nuevos.
- **G6** — sin cambios en la superficie de API pública; el reloj
  de G6 no se ve afectado.

### 0.7.1 — Rendimiento + arranque de validación externa (reetiquetada desde la antigua 0.7.0)

Criterios cerrados: completar **G5** (rango `sqref` de CF/DV de
ADR-0040), **G8** (benchmarks de rendimiento), **G9** (fixtures de
regresión de rendimiento), **G10** (multinavegador), **G11** (Stage 2
en CI), **G20** (borrador de SECURITY.md + modelo de amenazas), **G21**
(documentación de límites duros + AbortSignal).

También cierra el suelo de **G1 ≥ 140 fixtures** al aterrizar los
fixtures 141–187 reservados por los ADR de 0.7.0.

Avance hacia: **G12** (fijación de comportamiento indefinido), **G13**
(xl3-py).

Reetiquetado: `alfa` → `beta` después de que G8 publique y xl3-py
alcance ≥ 50% de Stage 1.

### 0.8.0 — Criterios sociológicos

Criterios cerrados: **G14** (ADR externo), **G15** (caso productivo),
**G16** (ampliación del conjunto de mantenedores o aceptación explícita
del modelo de mantenedor único), **G19** (guía de migración), completar
**G20**.

Este hito es el largo. El plan es ir enviando parches 0.8.x durante el
periodo de reclutamiento en vez de esperar en silencio.

### 0.9.0-rc.x — Congelación pre-1.0

Criterios cerrados: **G3**, **G6**, **G7**, **G23** (≥ 21 días de
maduración del RC).

Después de que arranque G23, el reloj del trimestre de G24 empieza
(tiene que haber arrancado mientras G3/G6/G7/etc. se estaban cerrando
— ver las definiciones de arriba).

### 1.0.0 — Corte final

Criterio cerrado: **G24** (trimestre de 90 días completado después de
que el último criterio marque tick).

## Reclutamiento y difusión

Los criterios sociológicos (G13/G14/G15/G16) necesitan personas, no
código. El proyecto tiene dos superficies de reclutamiento distintas:

### Audiencia coreana de operaciones (G15, futuros contribuidores del cookbook)

Canales: comunidades de desarrollo coreanas (Naver Café, Kakao 오픈톡,
LinkedIn KR), encuestas internas a autores de plantillas en empresas /
proveedores. Cada release menor publica un post en coreano ligado al
momento del lanzamiento (0.6 = demo de `@group`/`@subtotal` para
patrones de subtotal en facturas; 0.7 = números de rendimiento; 0.8 =
caso de estudio).

### Audiencia OSS angloparlante (G13, G14)

Canales: HN, lobste.rs, r/excel, CFP de conferencias (JSConf,
EuroPython para xl3-py). Cada momento grande se acompaña de un
artefacto externo concreto:

- Release 0.7.0: "Show HN: xl3 0.7 — motor de plantillas Excel
  para 100k filas"
- Release 0.8.0: caso de estudio + dashboard de conformidad de
  xl3-py
- Release 1.0.0: especificación + validación multi-implementación

## No-objetivos para 1.0

Estos están diferidos intencionalmente. Cada uno tiene un ADR que
explica por qué:

- **Aritmética de fechas más allá de Y/M/D/EOMONTH/EDATE/DATEDIF** — el
  resto de la familia se difiere según la [enmienda de ADR-0019](./spec/decisions/0019-deferred-date-arithmetic.md).
- **Collation de cadenas con conciencia de locale** —
  [ADR-0020](./spec/decisions/0020-deferred-locale-collation.md).
- **Multi-join, left-join, coincidencias multi-fila** —
  [ADR-0014](./spec/decisions/0014-source-joins.md), sección de fuera de
  alcance.
- **Comodín / aproximado / búsqueda inversa de XLOOKUP** —
  [ADR-0013](./spec/decisions/0013-xlookup-cross-source-lookup.md),
  sección de fuera de alcance.
- **Inserción dinámica de imágenes** — [ADR-0037](./spec/decisions/0037-rejected-dynamic-image-insertion.md).
- **Mutación de celdas en runtime** — [ADR-0042](./spec/decisions/0042-rejected-runtime-cell-mutation.md).
- **Funciones rechazadas por el filtro de ADR-0043** — expansión
  matemática, tests de tipos (excepto `ISBLANK` según ADR-0047),
  NOW / WEEKDAY etc., agregados condicionales, expansión de tokens de
  formato de TEXT(). Ver
  [ADR-0045](./spec/decisions/0045-function-batch-rejected.md).
- **Salida en streaming / análogo de SXSSF.** Diferido a 1.1+. **En
  1.0, los límites duros de memoria/filas se documentan (G21) en su
  lugar.**
- **API de caché para compilación de plantillas.** Diferido a 1.1+.
- **Salida PDF / HTML.** Fuera de alcance; xl3 es xlsx-in, xlsx-out.
- **Fixtures Stage 2 cross-writer más allá de `093`** —
  enmienda a [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md).

Estos siguen como candidatos para **XTL 1.1, 1.2, 1.x** según la
demanda.

## Cómo ayudar a cerrar elementos

| Elemento | Cómo ayudar |
|---|---|
| G13 segunda implementación ≥ 80% | Contribuye a [xl3-py](https://github.com/jinyoung4478/xl3-py) o arranca un nuevo portado (Rust, Java, Go). Ver [PORTERS_GUIDE.md](./PORTERS_GUIDE.md). |
| G14 ADR externo | Elige un elemento diferido (preservación de tablas dinámicas, salto de página, alguna función excluida de ADR-0045) y redacta un ADR en `spec/decisions/`. Ver "Cómo entran los cambios en el proyecto" en [GOVERNANCE.md](./GOVERNANCE.md). Hay varios "stubs de ADR para empezar" disponibles como issues `good-first-ADR` en GitHub. |
| G15 caso productivo | Usa xl3 internamente y comparte qué funcionó y qué no. Añade una fila en [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) si es apropiado. El propio empleador del mantenedor (Snack24h) califica si publica un caso de estudio. |
| G17 i18n coreano del cookbook 16+17 | Traduce las dos recetas más nuevas (el resto ya está hecho). |
| G8 benchmarks | Ejecuta `npm run bench` sobre plantillas representativas y comparte resultados. |
| G10 multinavegador | Añade Safari + Firefox al smoke test del bundle. |
| Re-propuesta de función | Si necesitas una función rechazada por ADR-0045, abre una incidencia con la plantilla [`Function re-proposal`](https://github.com/jinyoung4478/xl3/issues/new?template=function-reproposal.md). |

## Cómo evoluciona esta hoja de ruta

Este documento es el resumen ejecutivo público + la tabla de criterios
es la única fuente de verdad. El más profundo
[`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
mantiene el análisis de huecos, la frontera filosófica y la
justificación por versión. A medida que los criterios marquen tick,
ambos documentos se actualizan. A medida que afloran nuevos huecos,
ambos los incorporan.

Los recortes y adiciones a la tabla de criterios de 1.0 se discuten por
el mismo proceso de ADR/issue que todo lo demás.
