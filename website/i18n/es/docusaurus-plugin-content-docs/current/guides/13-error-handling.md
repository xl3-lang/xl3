---
sidebar_label: '13 · Manejo de errores para hosts'
pagination_label: '13 · Manejo de errores para hosts'
---

# 13 · Manejo de errores para hosts

## Escenario

Tu aplicación llama a `convert(templateBuffer, dataBuffer)`. La plantilla tiene una errata, o a los datos les falta una columna obligatoria. ¿Y ahora qué?

xl3 lanza **errores estructurados** (según ADR-0015) con una cadena `error.code` estable. Los hosts despachan según el código — para localización, lógica de reintentos o mensajes amigables al operador.

## Capturar + despachar

```ts
import { convert, isXtlError } from '@jinyoung4478/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // entrega los outputs
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('Al archivo de datos le faltan columnas obligatorias.', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('Dos archivos de salida tendrían el mismo nombre. Revisa los datos.', err.message);
      default:
        return showOperator('Falló la conversión.', err.message);
    }
  }
  // Error no propio de xl3: probablemente un fallo del sistema. Relánzalo.
  throw err;
}
```

`isXtlError(value)` devuelve `true` solo para instancias de `Error` cuyo `code` empieza por `xl3/`. Un `Error` plano, `DOMException`, etc., no coinciden.

## El catálogo de códigos de error

Estable. Solo añade nuevos. Renombrar es un cambio incompatible según ADR-0015. Conjunto actual:

- **`xl3/cell/*`** — fallos a nivel de celda (`formula-no-cache`, `numfmt-coercion`, `row-outside-repeat`)
- **`xl3/eval/*`** — evaluación de expresiones (`arity-mismatch`, `operand-coercion`, `unsupported-syntax`)
- **`xl3/config/*`** — problemas con `__config__`
- **`xl3/inputs/*`** — fallos en las entradas en tiempo de ejecución
- **`xl3/source/*`** — problemas con los datos de origen (cabeceras faltantes, fuentes no declaradas, nombres de columna reservados)
- **`xl3/sources/*`** — problemas con la hoja `__sources__`
- **`xl3/sheet/*`** — problemas con nombres de hoja
- **`xl3/directive/*`** — sintaxis de directivas
- **`xl3/join/*`** — problemas con la cláusula `@join`
- **`xl3/xlookup/*`** — fallos en `XLOOKUP`
- **`xl3/filename/*`** — problemas con nombres de archivo de salida
- **`xl3/parser/*`** — fallos del parser
- **`xl3/lists/*`** — problemas con referencias a `__lists__`

Lista completa en [`src/error-codes.ts`](https://github.com/jinyoung4478/xl3/blob/main/src/error-codes.ts).

## Casos comunes que conviene manejar explícitamente

**Entrada obligatoria faltante** (`xl3/inputs/missing-required`):
La plantilla declara una entrada como `required: true` y el host no la suministró. Muestra un formulario, pregunta al operador, reintenta.

**Colisión de nombres de archivo** (`xl3/filename/collision`):
Dos claves de grupo distintas se sanean al mismo nombre de archivo (por ejemplo, `Madrid/España` y `Madrid:España` quedan en `Madrid_España.xlsx`). Normalmente el operador debe limpiar los datos, no la plantilla.

**Mezcla de fuentes en XLOOKUP** (`xl3/xlookup/source-mismatch`):
El autor de la plantilla escribió `XLOOKUP(x, A[k], B[v])` donde `A` y `B` son fuentes distintas. Hay que corregir la plantilla, no es problema del operador.

**Sin coincidencia en XLOOKUP** (`xl3/xlookup/no-match`):
El valor de búsqueda no aparece en la columna de búsqueda. O los datos del operador están incompletos, o la plantilla debería usar `@join` (descarta filas sin coincidencia).

## Idioma

`error.message` está en inglés. Para localizar, despacha por `error.code` en tu host y proporciona tus propios mensajes — **no** traduzcas las cadenas inglesas del motor. El texto en inglés forma parte del contrato de conformancia (los fixtures comprueban subcadenas).

## Previsualizar antes de convertir

`preview(template, data, options)` ejecuta el mismo parse + dispatch que `convert` pero no renderiza los libros. Si tu host tiene un botón "Validar" antes de "Convertir", llama a `preview` — es rápido, detecta los mismos errores y no malgasta generación de xlsx.

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings: incidencias no fatales
// preview.inputs: valores de entrada resueltos (tras defaults y coerción)
// preview.files / preview.sources: lo que produciría convert()
```

## Referencias de especificación

- ADR-0015 — Notificación estructurada de errores.
- [`spec/evaluation.md`](/es/spec/evaluation) "Errors".
- [Receta 06](./06-runtime-inputs.md) para errores relacionados con entradas.
