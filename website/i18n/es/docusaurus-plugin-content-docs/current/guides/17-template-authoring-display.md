---
sidebar_label: '17 · Vista durante la autoría'
pagination_label: '17 · Vista durante la autoría'
---

# 17 · Vista durante la autoría de plantillas

## Situación habitual

Abres tu `template.xlsx` en Excel para editarlo. Ves:

- Una celda `=VLOOKUP("Acme", Data!A:B, 2, FALSE)` mostrando `#N/A`.
- Una celda `=Data!B2 + 100` mostrando `#VALUE!`.
- Una celda formateada como moneda `€#,##0` mostrando `{{ [Importe] }}` como texto plano.
- Una alerta de validación de datos saltando al hacer clic en una celda con marcador.

**Ninguno es un bug.** Cuando xl3 renderiza la plantilla, todos desaparecen:

- Los marcadores de la hoja Data se reemplazan por valores reales.
- VLOOKUP encuentra "Acme" en la columna A.
- El `+100` funciona porque la celda ahora es un número.
- El formato de moneda aplica al número sustituido.
- Las reglas de validación se aplican al valor real.

Esta receta explica *por qué* la vista de plantilla muestra lo que muestra y qué hacer si la encuentras ruidosa. (ADR-0049 es el contrato detrás de esto.)

## Por qué los marcadores se muestran como texto literal

Cuando la plantilla tiene una celda con valor `{{ [Importe] }}` formateada como `#,##0.00`, Excel ve una cadena no numérica en una celda numérica. Comportamiento de Excel:

- Mostrar el texto tal cual (sin auto-formato).
- No mostrar el triángulo verde de "Número guardado como texto" (la heurística requiere contenido con aspecto numérico; `{{ ... }}` no lo es).
- No fallar (es una cadena plana, no una fórmula malformada).

La celda muestra `{{ [Importe] }}` en tu vista de edición. Tras el render de xl3, la misma celda muestra `1.234,56` (o lo que produzca la combinación valor × formato).

**Es intencional.** Los marcadores visibles hacen la plantilla *autodocumentada*: ves qué celdas son dinámicas y cuáles fijas sin ejecutar nada. Un revisor puede abrir el archivo y leer el contrato directamente.

## Por qué las fórmulas de dashboard muestran errores (y cómo limpiarlas)

Una hoja de dashboard suele tener fórmulas como:

```excel
=VLOOKUP("Acme", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

Al abrir la plantilla (antes del render), estas referencian las filas con marcadores de la hoja Data. Los lookups no encuentran coincidencia (las cadenas no casan con la clave literal); la aritmética sobre una cadena devuelve `#VALUE!`. Resultado: un mar de celdas rojas en el dashboard durante la autoría.

### Solución: envolver con `IFERROR`

La respuesta nativa de Excel. Una línea por fórmula, se aprende en segundos.

```excel
=IFERROR(VLOOKUP("Acme", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

Vista pre-render de la plantilla: limpia (`—`, `0`).
Salida post-render: valores reales (xl3 no toca el texto de la fórmula según [ADR-0046](/es/spec/decisions/0046-cell-formula-preservation); Excel recalcula al abrir y el envoltorio se vuelve invisible).

### Qué fórmulas necesitan el envoltorio

| Fórmula | ¿Error en la vista de plantilla? | ¿Envolver? |
|---|---|---|
| `=SUM(Data!B:B)` | No — SUM ignora texto en rangos, devuelve 0 | Opcional |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | No — devuelve 0 si no hay coincidencias | Opcional |
| `=COUNTIF(Data!A:A, "VIP")` | No — devuelve 0 | Opcional |
| `=AVERAGE(Data!B:B)` | **Sí** — `#DIV/0!` si no hay números | Sí |
| `=VLOOKUP("clave", Data!..., ...)` | **Sí** — `#N/A` si no hay coincidencia | Sí |
| `=INDEX(...,MATCH("clave",Data!A:A,0))` | **Sí** — `#N/A` | Sí |
| `=Data!B2 + N` (aritmética sobre celda) | **Sí** — `#VALUE!` | Sí |
| `=Data!B2 & " texto"` (concat de texto) | No — concat con marcador funciona | No |
| `=COUNTA(Data!A:A)` | No — cuenta celdas no vacías, los marcadores cuentan | No |

**Regla de oro:** envuelve todo lo que devuelva `#N/A`, `#VALUE!` o `#DIV/0!` contra una fila con marcador. Las funciones de tipo agregado (`SUM`, `COUNT*`, `SUMIF*`) toleran el texto y no necesitan envoltorio.

## Verificar la salida renderizada

No tienes que deducir la salida renderizada a partir de la vista de plantilla. Tres caminos rápidos:

### 1. Playground de xl3.io

Suelta `template.xlsx` + un `data.xlsx` de muestra (o usa las muestras incluidas) en [xl3.io](https://xl3.io). Ves el libro renderizado en segundos.

### 2. API `preview()` en tu host

Si estás embebiendo xl3 en un host de TypeScript:

```ts
import { preview } from '@jinyoung4478/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // filas de origen detectadas
console.log(result.files);     // archivos y hojas de salida
console.log(result.warnings);  // incidencias no fatales
```

`preview()` ejecuta las mismas fases de parsing + evaluación temprana que `convert()`, pero no produce los bytes del libro — útil para validación del lado del host antes de disparar el render completo.

### 3. Prueba rápida por CLI

```bash
# Construye los libros de ejemplo (si quieres muestras frescas)
npm run examples:build

# Renderiza uno y míralo
node -e "
import('@jinyoung4478/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

Abre `rendered-*.xlsx` para ver la salida real.

## Alertas de validación de datos durante la autoría

Si pones una regla de validación tipo "debe ser un número entre 0 y 100" en una columna y luego haces clic en una celda con marcador durante la autoría, Excel muestra la alerta de validación ("Este valor no coincide con la regla").

Opciones:

- **Configura el estilo de validación como `Advertencia` o `Información`** en lugar de `Detener` — la alerta sigue apareciendo pero no bloquea la edición.
- **Coloca la validación en una celda sin marcador que se propague a las filas de datos.** La preservación de xl3 (ADR-0036 §8) lleva la regla a las filas expandidas.
- **Acepta la alerta al hacer clic** — desaparece cuando xl3 sustituye con el valor real, y los operadores que ven el archivo renderizado nunca la ven.

## Lo que xl3 deliberadamente NO hace

Este es el contrato de [ADR-0049](/es/spec/decisions/0049-template-display-vs-render-output):

1. xl3 **no** pre-sustituye los marcadores con valores de muestra para la vista de plantilla. (Eso perdería la señal visual del marcador.)
2. xl3 **no** mantiene dos `numFmt` separados por celda ("formato vista de plantilla" vs "formato render"). (Superficie extra de spec con ganancia marginal.)
3. xl3 **no** envuelve automáticamente tus fórmulas de dashboard con `IFERROR`. (Cambiaría el texto de la fórmula en formas que ADR-0046 prohíbe; tragaría errores reales del autor en silencio.)

El autor es dueño de la vista de plantilla; el motor es dueño de la salida renderizada. Son cosas distintas por diseño.

## Véase también

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](/es/spec/decisions/0049-template-display-vs-render-output)
- [ADR-0046 — Cell formula preservation contract](/es/spec/decisions/0046-cell-formula-preservation)
- [Receta 16 — Funciones XTL vs. fórmulas de Excel](./16-xtl-vs-excel-formula.md)
- [Documentación de la API `preview()`](/es/api/functions/preview)
