# xl3

> Conversión de Excel, dentro de Excel, con sintaxis de Excel.
> Mantén las reglas recurrentes de transformación de Excel dentro de las plantillas del libro.

**Estado:** alpha · XTL spec 0.1 (draft) · son posibles cambios incompatibles hasta 1.0

xl3 es técnicamente capaz pero se encuentra en su fase formativa como
proyecto: un único mantenedor, ningún caso de referencia en producción
todavía, gobernanza recién documentada. La pasada de auditoría cerró
todas las superficies de paso silencioso, y la pasada de bloques de
datos de 0.8.0 deja el corpus en 70 ADR y 154 fixtures, todo en verde,
por lo que la superficie del lenguaje es lo bastante estable para los
primeros adoptantes. **El feedback de los primeros adoptantes
es ahora mismo la contribución más útil** — consulta
[ROADMAP.md](./ROADMAP.md) para ver qué bloquea la 1.0 y
[GOVERNANCE.md](./GOVERNANCE.md) para entender cómo se toman las
decisiones.

**Novedades de 0.7.0 → 0.8.0** (mayo de 2026): los bloques de datos
ahora tienen **alcance por columna** (ADR-0066). El rango de columnas
del bloque es la envolvente de todos los marcadores `{{ ... }}`,
extendida a través de las celdas no vacías adyacentes. Las celdas
fuera de ese rango — tablas de resumen laterales, columnas de
cabecera, notas a la derecha — conservan su fila original cuando el
bloque se expande, así que dejan de ser empujadas por el crecimiento
de filas. Esto cierra dos errores arrastrados: #46 (pérdida
silenciosa de datos por propietarios duplicados de fórmulas
compartidas) y #47 (referencias de fórmula obsoletas en celdas
laterales desplazadas).

0.8.0 también añade la directiva explícita **`@block`** (ADR-0067),
en tres formas:

- `{{ @block }}` — sin argumentos; el rango de columnas se infiere
  de los marcadores
- `{{ @block A:D }}` — rango de columnas explícito
- `{{ @block A2:D7 }}` — rectángulo fila × columna explícito

Las hojas que optan por `@block` activan la detección estricta de
multi-bloque (ADR-0068): todos los marcadores `[Column]` deben estar
dentro de algún bloque y los rectángulos no pueden solaparse. Las
demás directivas se enlazan por proximidad al bloque solapado más
cercano (ADR-0069). **Compatibilidad hacia atrás:** las plantillas
sin `@block` y sin contenido fuera de las columnas del bloque se
renderizan exactamente igual que en 0.7.x; `@block` es opcional
(opt-in).

**Novedades de 0.6.0 → 0.7.0** (mayo de 2026): una pasada de 15 ADR
(ADR-0051..0065) cerró todas las superficies restantes de conflicto
sintáctico — lugares donde una misma forma de plantilla podía
interpretarse de dos maneras o pasar silenciosamente. El cambio más
visible para los usuarios es **la forma de los argumentos de agregación**
(ADR-0059): `SUM`, `AVERAGE`, `MIN`, `MAX` y el `COUNT` de un solo
argumento requieren ahora una única referencia de columna (`[Column]` o
`Source[Column]`) y rechazan en tiempo de parsing la aritmética por
fila como `SUM([Qty] * [Price])` con
`xl3/eval/bad-aggregate-arg` — usa una columna auxiliar aguas arriba o
una fórmula nativa `=SUMPRODUCT(...)` en la celda de pie de tabla
(consulta [Cookbook 03](./docs/guides/03-aggregates.md) y
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)). Los demás ADR
de comportamiento fijado en 0.7.0 cubren los límites del delimitador de
literales de cadena (0051), la propagación de errores en texto mixto
(0053), la resolución de nombres simples (0054), la composición de
filas `@subtotal` (0058), las reglas del argumento value de `XLOOKUP`
(0060), las reglas de separación entre default y options en
`__inputs__` (0062, 0063) y el alcance de la coerción de cadena a
número (0064).

**0.5.x → 0.6.0** (principios de mayo de 2026): soporte nativo para
**cabeceras con celdas combinadas** en los libros de origen (ADR-0033)
— un patrón habitual en las plantillas de proveedores en Corea
(거래명세서, 정산서, 발주서; equivalentes a albaranes, liquidaciones y
órdenes de compra). Las filas de datos combinadas propagan el valor
maestro a las esclavas (ADR-0035). Una matriz normativa de preservación
de características cubre imágenes, formato condicional, rangos con
nombre, inmovilización de paneles, protección de hoja, validación de
datos y comentarios de celda (ADR-0036). 0.6.0 añade **`@group` /
`@subtotal`** para intercalar filas de subtotal por cliente o por mes
dentro de un único bloque de datos (ADR-0038) — el patrón canónico en
facturación B2B en Corea, igualmente aplicable a albaranes y
liquidaciones en cualquier mercado. Las celdas de `__inputs__` (default,
label, description, options) son ahora plantillas XTL evaluadas contra
un contexto restringido, por lo que las UIs anfitrionas ya no muestran
`{{ TODAY() }}` de forma literal (ADR-0050).

**Alcance (ADR-0043).** La superficie de funciones de XTL es
intencionadamente más pequeña que la de Excel. La regla: una función
vive en XTL solo cuando su valor debe conocerse **antes** de que el
libro se escriba — para `@filter`, `@sort`, `@group`, `@subtotal`,
agregaciones de origen, patrones de nombre de archivo o de hoja, o
valores por defecto de `__inputs__`. Todo lo que Excel pueda calcular
al abrir el libro (formato visual, operaciones aritméticas por celda,
comprobaciones de tipo) va en una fórmula de celda y xl3 la preserva
verbatim. Consulta
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md) para la guía
comparada.

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [繁體中文](./README.zh-TW.md) · **Español** · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

> **¿Estás creando una plantilla xl3 con un LLM (Claude, GPT, Gemini, Codex, Cursor, …)?** Lee primero [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md) — cubre el único error que los LLM cometen de forma fiable (filas con estilo residual que acaban contaminando cada salida) y cómo evitarlo. El documento se mantiene en inglés, ya que es material de referencia que consulta directamente el LLM.

---

## ¿Qué es xl3?

xl3 coloca la lógica de transformación de Excel **dentro del propio
archivo de Excel**, no en código. Quienes no programan pueden leer y
editar las reglas directamente, porque están escritas con los mismos
`IF`, `SUM` y referencias a columnas que ya usan a diario. El equipo de
desarrollo entrega el motor; el libro entrega el flujo de trabajo.

El planteamiento es sencillo:

- Quién: equipos operativos y analistas que no deberían tener que leer código
- Qué: reglas recurrentes de transformación de Excel
- Cómo: libros de plantilla, `source_table` y fórmulas de Excel ya conocidas

```text
raw.xlsx        (datos de entrada)
       +
template.xlsx   (contrato del flujo)
       ↓
result.xlsx     (libro terminado)
```

El equipo de desarrollo gestiona el motor en código. Los equipos
operativos usan un flujo basado en archivos: suben el Excel en bruto,
eligen la plantilla aprobada y descargan el libro terminado.

Las plantillas se redactan **dentro del propio Excel**. Pon la
configuración en `__config__`, añade expresiones como `{{ [Cliente] }}` o
`{{ IF([Renovacion] > 10000, "Prioritario", "Estandar") }}` a las
celdas, guarda el archivo y ejecuta xl3. Sin macros, sin scripts
ocultos, sin nube de un proveedor.

La plantilla es el artefacto de traspaso. Puede revisarse, versionarse,
archivarse y pasarse a la siguiente persona sin pedirle que lea el
código de automatización.

## Ejemplo rápido

Una plantilla puede contener contenido normal de Excel, `__config__` y
expresiones xl3:

| Clave `__config__` | Valor |
|---|---|
| `source_sheet` | `Datos` |
| `source_table` | `1` |
| `output_file_pattern` | `cliente-renovacion-informe.xlsx` |

| Celda | Valor de plantilla |
|---|---|
| A5 | `{{ [Cliente] }}` |
| B5 | `{{ [Region] }}` |
| C5 | `{{ [Renovacion] }}` |
| E5 | `{{ IF([Renovacion] > 10000, "Prioritario", "Estandar") }}` |

Dado este libro de datos:

| Cliente | Region | Renovacion | Responsable |
|---|---|---:|---|
| Logística Acme | Madrid | 18400 | Marta |
| Beta Talleres | Barcelona | 7200 | Javier |

xl3 produce:

| Cliente | Region | Renovacion | Responsable | Categoria |
|---|---|---:|---|---|
| Logística Acme | Madrid | 18400 | Marta | Prioritario |
| Beta Talleres | Barcelona | 7200 | Javier | Estandar |

La salida sigue siendo un libro `.xlsx`. El formato de la plantilla,
los formatos de número y las celdas combinadas forman parte del
resultado esperado, no son detalles incidentales.

Consulta [`spec/`](./spec) para el borrador del lenguaje y
[`conformance/`](./conformance) para el corpus de fixtures
independiente de la implementación y el protocolo del runner.

## Por qué existe xl3

Muchos flujos de generación de informes ya viven en hojas de cálculo:
informes de renovación, hojas de liquidación, exportaciones de
facturas, plantillas operativas internas. A menudo se automatizan con
scripts de Python puntuales, macros VBA o pasos específicos de algún
producto de flujos de trabajo. Eso funciona hasta que las reglas
quedan repartidas entre código, cuentas y conocimiento tribal.

xl3 separa el motor reutilizable del contrato específico del libro.
Mantén el despliegue, la validación y la integración en código; mantén
el flujo de negocio recurrente en el libro.

## Qué prioriza xl3

- **Un flujo basado en archivos.** `.xlsx` en bruto a la entrada,
  plantilla aprobada a la entrada, libro terminado a la salida.
- **Las reglas viajan con el libro.** `__config__`, expresiones,
  maquetación y forma de salida quedan archivadas en
  `template.xlsx`.
- **Motor gestionado por el equipo de desarrollo.** Usa la API de
  TypeScript desde una página web, un portal interno, una CLI o un
  endpoint de servicio.
- **Excel sigue siendo Excel.** Estilos, formatos de número, estructura
  de hojas y celdas combinadas se mantienen en el resultado.
- **Sin macros ni nube de proveedor.** El comportamiento de la
  plantilla es contenido explícito del libro.

## Cómo se compara

| Enfoque | Mejor en | Contrapartida |
|---|---|---|
| **xl3** | Construir motores de transformación de Excel basados en archivos donde el equipo operativo sube `.xlsx` en bruto y descarga libros terminados. Las reglas del flujo quedan en `template.xlsx`. | Alpha. La superficie de XTL es intencionadamente pequeña y todavía está evolucionando. |
| Scripts en Python o VBA | Automatización puntual y rápida cerca de las hojas de cálculo ya existentes. | Las reglas de negocio tienden a vivir en el código o en la cabeza de un único mantenedor, lo que dificulta el traspaso y la revisión. |
| Power Query / Office Scripts / Power Automate | Flujos en Microsoft 365, modelado de datos y automatización de acciones dentro del ecosistema de Excel. | Buen encaje con la plataforma, pero los flujos pueden acabar siendo específicos de un tenant, cuenta o entorno, en lugar de artefactos portables a nivel de libro. |
| SDKs de hoja de cálculo como SheetJS, ExcelJS o Aspose.Cells | Generación programática de libros, de bajo nivel o con funcionalidad completa. | Quien desarrolla suele acabar codificando las reglas específicas del informe directamente en el código de la aplicación. |
| Motores de plantilla o informes como JXLS o xltpl | Generación de informes en servidor a partir de plantillas tipo hoja de cálculo. | Útiles, pero a menudo atados a un lenguaje o runtime concreto; los flujos en navegador orientados al equipo operativo y el traspaso a nivel de libro no son la forma principal del producto. |
| SaaS de generación de documentos como Plumsail, Formstack o Conga | Flujos documentales gestionados, integraciones, aprobaciones y entrega. | Las reglas viven en el servicio del proveedor, no principalmente en una plantilla de libro portable que puedas autoalojar. |
| Generación de hojas con LLM | Exploración ad hoc y elaboración de borradores. | No es un contrato determinista de transformación para trabajo operativo recurrente. |

## Instalación

```bash
npm install @jinyoung4478/xl3
```

## Uso

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — uno o más .xlsx, según las reglas de agrupación de la plantilla
```

Funciona en navegadores y en Node (≥20.12).

### Navegador vía `<script>` (sin empaquetador)

Para proyectos que no usan empaquetador, un bundle IIFE autocontenido
expone `window.xl3`:

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

El bundle ocupa unos ~1 MB minificado (~300 KB con gzip). ExcelJS y
JSZip están incluidos en línea; no hace falta ninguna otra dependencia.

Puedes probar el flujo en navegador en [xl3.io](https://xl3.io):
ejecuta los archivos de muestra tal cual, descarga los libros de origen
y de plantilla, o sustituye cualquiera de los dos por el tuyo.

### Compatibilidad con versiones de Excel

xl3 lee archivos `.xlsx` vía OOXML y es en gran medida agnóstico
respecto a la versión por diseño — lee los resultados de fórmula
cacheados, normaliza fechas en UTC e ignora las diferencias de
serialización OOXML en la capa de valor de celda. Consulta
[ADR-0022](./spec/decisions/0022-excel-version-compatibility.md) para
la matriz completa; la versión corta es: usa la sintaxis `{{ ... }}` de
XTL para todo lo dinámico, evita gráficos, tablas dinámicas y fórmulas
nativas dentro de los bloques de datos, y elige un único sistema de
fechas (1900) para toda la organización.

Las plantillas seleccionan la tabla de origen en la hoja oculta
`__config__`:

| Clave | Ejemplo | Significado |
|---|---|---|
| `source_sheet` | `Datos` | nombre de la hoja de origen, o patrón de prefijo terminado en `*` |
| `source_table` | `1` | la fila 1 contiene los nombres de columna; las filas siguientes son datos |
| `source_table` | `A1:D` | A1-D1 contienen los nombres de columna; las filas siguientes son datos |
| `source_table` | `A1:D200` | A1-D1 contienen los nombres de columna; A2-D200 son datos |

Usa `source_table = N` para el caso habitual en el que la fila `N`
contiene los nombres de columna en bruto. Recurre a la forma de rango
cuando la tabla empiece en una columna posterior o necesite acotar una
fila final.

### Hojas reservadas

Las plantillas usan cuatro hojas reservadas con doble guion bajo (según
ADR-0011):

| Hoja | Propósito |
|---|---|
| `__config__` | configuración y diccionario de valores definidos por la persona autora; se accede vía `{{ __config__[name] }}` |
| `__inputs__` | valores que aporta el host por ejecución (ADR-0010); se declaran con columnas `name`/`type`/`default`/`label`/`description`/`options` |
| `__sources__` | fuentes de datos con nombre adicionales más allá del `source_sheet` por defecto (ADR-0012); se declaran con columnas `name`/`sheet`/`table`/`description` |
| `__lists__` | listas de pertenencia para `@filter [field] in __lists__[name]` |

Las hojas creadas por la persona autora que coincidan con
`^__[a-z]+__$` están reservadas y se rechazan en tiempo de parsing.

### Datos multi-origen

Más allá del `source_sheet` por defecto, las plantillas pueden declarar
fuentes con nombre en `__sources__` y referenciarlas con la forma de
referencia estructurada de Excel:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` cambia el alcance de un bloque de datos para que la
forma abreviada con corchetes (`[Column]`) se resuelva contra `<Name>`
en lugar de contra la fuente por defecto. `@join` empareja las filas
primarias con filas de una segunda fuente por clave (inner-join,
primera coincidencia). Consulta
[`spec/language.md`](./spec/language.md) para la sintaxis completa de
las directivas.

### Entradas en tiempo de ejecución

Las plantillas que necesitan valores por ejecución (un mes objetivo, un
filtro de cliente, una etiqueta) los declaran en `__inputs__` y el host
los pasa a `convert(...)`:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Madrid' },
});
```

Las entradas fluyen hacia las celdas (`{{ __inputs__[month] }}`), los
patrones de nombre de archivo y las claves de agrupación.

## Ejemplos

En [`examples/`](./examples) viven cuatro plantillas con forma de
producción: informe básico de renovación, una hoja por región con
filtro por lista, un join multi-origen con entradas en tiempo de
ejecución y un informe semanal de cafetería que muestra los subtotales
por categoría con `@group` + `@subtotal`. Ejecútalos con
`npm run examples:build && npm run examples:run`.

## Guías

Recetas breves y listas para copiar y pegar sobre flujos comunes viven
en [`docs/guides/`](./docs/guides). Dieciocho recetas que cubren los
primeros pasos, condicionales, agregaciones, agrupación por archivo o
por hoja, entradas en tiempo de ejecución, joins, `XLOOKUP`, ordenación
y top-N, estilo, texto multilínea, valores vacíos, manejo de errores,
valores de `__config__`, composición de directivas, XTL vs fórmula de
Excel, visualización al redactar la plantilla y `@group` /
`@subtotal`.

## Spec

La spec de XTL es neutral respecto al lenguaje y vive en
[`spec/`](./spec). Este repositorio aporta la implementación de
referencia en TypeScript. Las portabilizaciones a otros lenguajes son
bienvenidas — consulta [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).

Ejecuta el corpus de conformidad en local:

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

Un resumen de la última ejecución de la implementación de referencia
— junto con columnas para los informes de cualquier portabilización
externa depositados en
[`conformance/reports/`](./conformance/reports/) — vive en
[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md). Para
regenerarlo, usa `npm run conformance:dashboard`.

## Estructura del proyecto

- `spec/` — borrador normativo del lenguaje XTL.
- `conformance/` — corpus de fixtures y protocolo del runner, neutrales respecto a la implementación.
- `src/` — implementación de referencia en TypeScript.

La spec es la fuente de verdad. Los fixtures de conformidad hacen que
el comportamiento de la spec sea ejecutable. La implementación de
referencia es útil, pero no es normativa.

## Licencia

- Código (`src/`, `conformance/`): [MIT](./LICENSE)
- Spec XTL (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft y Excel son marcas comerciales de Microsoft Corporation. xl3
no está afiliado a Microsoft. El formato Office Open XML (`.xlsx`) se
publica como ISO/IEC 29500.
