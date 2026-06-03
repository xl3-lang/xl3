---
sidebar_label: '14 · __config__ como diccionario'
pagination_label: '14 · __config__ como diccionario'
---

# 14 · `__config__` como diccionario de valores

## Escenario

Varias celdas referencian la misma constante — un nombre de departamento, un umbral de fecha, un corte de renovación. Repetir el literal en cada celda es frágil; un único cambio implica buscar y reemplazar por toda la plantilla. `__config__` también funciona como un diccionario de valores que el autor puede leer desde cualquier celda.

## Cómo funciona

Según ADR-0011, `__config__` es la hoja de configuración reservada. Tiene dos columnas: `key` y `value`. Algunas claves están definidas por la especificación (`name`, `description`, `source_sheet`, `source_table`, `output_file_pattern`, `match_pattern`). Cualquier otra clave la define el autor y es accesible vía:

```text
{{ __config__[key_name] }}
```

## Ejemplo

`__config__`:

| clave | valor |
|---|---|
| `source_sheet` | `Datos` |
| `source_table` | `1` |
| `output_file_pattern` | `informe.xlsx` |
| `priority_threshold` | `10000` |
| `default_region` | `Madrid` |
| `report_owner` | `Marta` |

Celdas de plantilla:

```text
{{ "Preparado por " & __config__[report_owner] }}
{{ IF([Renovacion] > __config__[priority_threshold], "Prioritario", "Estandar") }}
{{ IFEMPTY([Region], __config__[default_region]) }}
```

Cambiar `priority_threshold` de 10000 a 5000 actualiza todas las celdas a la vez. El autor edita una sola celda en `__config__`, no 20 expresiones repartidas por el informe.

## Conciencia de tipos

Los valores guardados en `__config__` mantienen el tipo de la celda con la que se autoraron:

- Las celdas numéricas se vuelven números (`10000` se compara como numérico).
- Las celdas de cadena se vuelven cadenas.
- Las celdas de fecha se vuelven fechas.
- Los booleanos se vuelven booleanos.

```text
__config__[priority_threshold] > 5000     ← comparación numérica
__config__[start_date] = TODAY()           ← comparación de fechas
```

Si necesitas forzar un tipo, guarda el valor con el tipo de celda Excel correspondiente. Para una conversión explícita en la plantilla, usa `TEXT()` (número → cadena) o aritmética (`__config__[x] + 0` para coercer cadena-numérica → número).

## Claves reservadas que no puedes reutilizar

Según ADR-0011, las siguientes claves de `__config__` están definidas por la especificación y las lee el propio motor; no las sombrees con semántica personalizada:

- `name`
- `description`
- `source_sheet`
- `source_table`
- `output_file_pattern`
- `match_pattern`

Las claves personalizadas NO DEBEN coincidir con `^__[a-z]+__$` (los nombres rodeados de doble guion bajo como `__foo__` están reservados según ADR-0027). Un único `_` inicial está bien. Por lo demás, cualquier identificador es válido.

## ¿Por qué no ponerlo en los datos de origen?

Dos opciones para "constantes compartidas" en un flujo de trabajo:

1. **Claves de `__config__` definidas por el autor** — el valor vive en la plantilla. Los cambios requieren re-versionar la plantilla. Es lo mejor para constantes de toda la organización que el operador no debería editar.
2. **Declaraciones de `__inputs__` con `default`** — el valor vive en la plantilla pero el host puede sobrescribirlo por ejecución. Es lo mejor para parámetros por ejecución (mes objetivo, umbral) que el operador pueda ajustar.

Usa `__config__` para "esta plantilla está cableada a estas constantes; actualiza la plantilla para cambiarlas". Usa `__inputs__` para "esta plantilla acepta parámetros; el host los decide en cada ejecución".

## Referencias de especificación

- ADR-0011 — Nombres reservados de hojas.
- [`spec/evaluation.md`](/es/spec/evaluation) "Template Configuration".
- [Receta 06](./06-runtime-inputs.md) para `__inputs__` (la alternativa por ejecución).
