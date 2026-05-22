---
sidebar_label: '06 · Entradas en tiempo de ejecución'
pagination_label: '06 · Entradas en tiempo de ejecución'
---

# 06 · Entradas en tiempo de ejecución

## Escenario

La plantilla es genérica, pero cada ejecución apunta a un mes o una región concretos. No quieres que el operador edite la plantilla — pasa el valor en el momento de la conversión.

## Declarar en `__inputs__`

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `Mes objetivo (YYYY-MM)` | |
| `region` | `select` | `false` | `Todas` | `Filtro de región` | `Todas\|Madrid\|Barcelona\|Valencia` |

Valores de tipo: `text`, `number`, `date`, `select`.

## Usar en celdas, nombres de archivo y claves de grupo

```text
Celda:          {{ "Informe de " & __inputs__[month] }}
Nombre archivo: output_file_pattern = {{ __inputs__[month] }}-renovaciones.xlsx
Filtro:         {{ @filter [Region] = __inputs__[region] OR __inputs__[region] = "Todas" }}
```

Espera — esa última versión no funciona tal como está escrita; XTL no tiene palabra clave `OR`. El patrón limpio es tener dos hojas plantilla escogidas por una condición previa. Por ahora, el uso más sencillo de `__inputs__` es inyectar un valor literal en una celda, en un nombre de archivo o en una comparación fija:

```text
{{ @filter [Region] = __inputs__[region] }}
```

…y que el host solo llame a `convert()` después de que el operador seleccione una región concreta.

## Pasar valores desde el host

```ts
import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Madrid' },
});
```

Si falta `inputs.month` y `month` está marcado como obligatorio, xl3 lanza `xl3/inputs/missing-required` en el momento de la conversión. Si no se suministra `region`, se aplica el `default` (`Todas`).

## Inspeccionar las entradas declaradas sin ejecutar

```ts
import { readTemplateInputs } from '@jinyoung4478/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

Útil en una UI del host para renderizar un formulario antes de que el operador haya subido el archivo de datos.

## Valores por defecto y etiquetas calculadas (ADR-0050)

Las columnas `default`, `label`, `description` y `options` son plantillas XTL que se evalúan al leer las entradas. Puedes componer valores a partir de `__config__` o llamar a funciones escalares puras:

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[region] }} Albarán` | `Prefijo del título` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `Fecha del informe` |
| `report_label` | `text` | `{{ UPPER(__config__[region]) }}-{{ __config__[period] }}` | `Etiqueta del informe` |

La UI del host que llama a `readTemplateInputs()` ve las cadenas ya evaluadas (por ejemplo, `"ES Albarán"`, la fecha UTC actual). El usuario ya no ve el marcador `{{ ... }}` en bruto.

**Enlaces disponibles al leer las entradas:**

- `__config__[key]` — valores declarados antes en la hoja `__config__`.
- Funciones escalares puras: `TODAY`, `DATE`, `IF`, `IFEMPTY`, `IFS`, `IFERROR`, `UPPER`, `LOWER`, `TRIM`, `TEXT`, `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`, `ROUND`, `ABS`.

**No disponible — esto lanza al leer las entradas:**

- `[Column]` / `Source[Column]` — todavía no hay contexto de fila de origen. Código de error: `xl3/inputs/forward-reference`.
- `__inputs__[name]` — las filas de entrada son declaraciones independientes, no un grafo de dependencias. Mismo código de error.
- `ROW()`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP` — leen estado de render o datos de origen que aún no existen. Código de error: `xl3/inputs/runtime-only-fn`.

> **Nota de migración.** Antes de 0.6, `{{ ... }}` en celdas de `__inputs__` se trataba como texto literal. Si una plantilla existente contenía un bloque `{{ ... }}` cerrado con intención literal, ahora ese contenido se evalúa como expresión. La mayoría de los autores no se verá afectada — el comportamiento anterior era sorprendente en la práctica.

## Notas

- Las opciones de `select` se separan por barras verticales en la fila de `__inputs__` (p. ej. `Madrid|Barcelona|Valencia`). Un valor suministrado que no esté en las opciones lanza `xl3/inputs/select-option`. La división por `|` ocurre **después** de evaluar la plantilla de la celda, así que `options: {{ __config__[regions] }}` funciona si `__config__[regions]` es la cadena literal `Madrid|Barcelona|Valencia`.
- Las entradas de tipo fecha se parsean como `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm:ss`.
- Las entradas numéricas aceptan literales de número de JS; se permiten espacios al final.
- Referencia de especificación: [`spec/evaluation.md`](../../spec/evaluation.md) "Inputs"; ADR-0010, ADR-0011, ADR-0050.
