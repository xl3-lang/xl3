# xl3

> **El runtime determinista para informes de Excel generados por IA.**
> Un LLM escribe la plantilla, xl3 renderiza el libro — misma plantilla,
> mismos datos, mismos bytes, siempre.

**Estado:** alpha · XTL spec 0.1 (draft) · son posibles cambios incompatibles hasta 1.0

xl3 es un pequeño motor en TypeScript que convierte un par de archivos
`.xlsx` — una **plantilla** (el contrato del flujo) y **datos en
bruto** — en un libro terminado y formateado. La plantilla es en sí
misma un `.xlsx`, redactado en Excel con fórmulas conocidas más un
pequeño lenguaje de expresiones embebido (XTL) para aquello que debe
conocerse *antes* de escribir el libro: filtros, grupos, agregaciones,
patrones de nombre de archivo.

Encaja bien cuando la plantilla la genera, edita o revisa un LLM
(Claude, GPT, Gemini, Cursor, Codex, …) y necesitas que la capa de
**ejecución** se mantenga determinista, inspeccionable y verificable —
no "una IA adivinando las celdas de salida".

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [繁體中文](./README.zh-TW.md) · **Español** · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## La división: el modelo escribe, el runtime renderiza

```text
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │   LLM (Claude / GPT /    │         │         xl3              │
  │   Gemini / Cursor / …)   │         │  (runtime determinista)  │
  │                          │         │                          │
  │   lenguaje natural       │         │   template.xlsx          │
  │   + informe de muestra ► │  emite  │   + raw.xlsx             │
  │                          │         │   → result.xlsx          │
  │   "liquidación mensual   │         │                          │
  │    por región, con       │         │   mismas entradas        │
  │    subtotales por región"│         │   → mismos bytes, siempre│
  └──────────────────────────┘         └──────────────────────────┘
       creativo, estocástico              aburrido, reproducible
```

Los LLM son buenos *redactando* la forma de un informe a partir de un
prompt y una muestra. Son malos produciendo el mismo `.xlsx` dos veces,
preservando estilos de celda o respetando "esta columna debe agregarse
siempre con SUM". xl3 cubre ese hueco: el modelo emite una plantilla
`.xlsx` una sola vez; cada renderización posterior es una función pura
de `(plantilla, datos, entradas)`.

Esta división es para lo que están diseñados
[`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md), el
corpus de conformidad de 154 fixtures, y la superficie de XTL,
intencionadamente pequeña.

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

…con los formatos de número, rellenos, bordes, cabeceras combinadas y
filas de pie de la plantilla preservados verbatim. La salida es un
`.xlsx` que puedes abrir en Excel, Numbers o Google Sheets sin
conversión.

Consulta [`spec/`](./spec) para el borrador del lenguaje y
[`conformance/`](./conformance) para el corpus de fixtures neutral a
la implementación y el protocolo del runner.

## Por qué el runtime debe ser aburrido

El argumento en un párrafo: **cualquier cosa que un LLM emita como
Excel está a un token erróneo de convertirse en un informe roto.** Las
fórmulas de celda se desvían, una combinación se mueve una fila, un
símbolo de moneda acaba como un `$` literal en vez de un formato de
número. El trabajo de xl3 es hacer que la *ejecución* de esa plantilla
sea predecible para que el modelo solo tenga que acertar *una vez*.

Concretamente:

- **Una superficie XTL pequeña y auditable (ADR-0043).** Una función
  vive en XTL solo cuando su valor debe conocerse *antes* de que el
  libro se escriba. Todo lo demás es una fórmula de celda normal de
  Excel y Excel la evalúa al abrir el archivo. Cuanto más pequeño es
  el lenguaje, más pequeña es la superficie que un LLM tiene que
  aprender — y más pequeña es la superficie que hay que verificar.
  Consulta [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)
  para la guía comparada.
- **Corpus de conformidad.** 154 fixtures, todos en verde, en 70 ADR.
  Es el banco de pruebas contra el que se puede comprobar la plantilla
  de un LLM *antes* de que toque siquiera datos reales.
- **Una implementación, una spec.** El directorio [`spec/`](./spec)
  define XTL de forma independiente de esta referencia en TypeScript.
  Las portabilizaciones a otros runtimes son bienvenidas; el corpus es
  el contrato.
- **Sin macros, sin nube de proveedor.** Una plantilla es un `.xlsx`
  corriente. Puedes diferenciarla, revisarla en una pull request y
  pasarla a una persona revisora que nunca haya oído hablar de xl3.

Las mismas propiedades hacen que xl3 sea útil incluso **sin un LLM en
el flujo** — equipos operativos y analistas pueden leer y editar las
plantillas directamente, porque las expresiones están escritas con los
mismos `IF`, `SUM` y referencias a columnas que ya usan a diario. El
enfoque IA es la cuña; la legibilidad humana es la cola larga.

## Cómo se compara

| Enfoque | Mejor en | Contrapartida para Excel impulsado por IA |
|---|---|---|
| **xl3** | La mitad de ejecución de un pipeline de Excel redactado por un LLM. El modelo escribe la plantilla una vez; xl3 renderiza de forma determinista en cada ejecución. | Alpha; un único mantenedor; la superficie de XTL es intencionadamente pequeña y sigue evolucionando hasta 1.0. |
| LLM directo → xlsx (function-call a un SDK de hoja de cálculo) | Borradores exploratorios rápidos, gráficos puntuales. | Cada renderización es no determinista; estilos, formatos de número y totales se desvían entre ejecuciones incluso con temperatura 0. |
| SheetJS / ExcelJS / openpyxl | Generación de libros a bajo nivel. | El modelo tiene que aprender toda la superficie del SDK y re-emitirla en cada renderización; la "plantilla" es código de aplicación, no un archivo portable. |
| Power Query / Office Scripts / Power Automate | Flujos en Microsoft 365, modelado de datos y automatización de acciones dentro del ecosistema de Excel. | Atados al tenant; las reglas del flujo no viajan con el libro. |
| JXLS / xltpl / receta xlsx de jsreport | Generación de informes en servidor a partir de plantillas tipo hoja de cálculo. | Útiles, pero anteriores al modelo del LLM como autor; sus DSL de plantilla son más amplios y no están diseñados para ser emitidos por un modelo. |
| SaaS de generación de documentos (Plumsail, Conga, Formstack) | Flujos documentales gestionados, integraciones, aprobaciones y entrega. | Las reglas viven en el servicio del proveedor, no en un libro portable que puedas entregar a un LLM para editar. |

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
