---
sidebar_label: '04 · Un archivo por grupo'
pagination_label: '04 · Un archivo por grupo'
---

# 04 · Un archivo por grupo

## Escenario

Tienes un informe de renovaciones y quieres un `.xlsx` por región en lugar de un único archivo grande. Los operadores pueden entregar el archivo de cada región directamente al equipo correspondiente.

## `__config__`

| clave | valor |
|---|---|
| `source_sheet` | `Datos` |
| `source_table` | `1` |
| `output_file_pattern` | `{{ [Region] }}.xlsx` |

La clave de grupo es lo que referencias en `output_file_pattern`. xl3 agrupa las filas de origen por el valor resuelto de ese patrón y emite un archivo por cada valor distinto.

## Datos (hoja `Datos`)

| Cliente | Region | Renovacion |
|---|---|---:|
| Acme | Madrid | 18400 |
| Beta | Barcelona | 7200 |
| Coreon | Madrid | 25100 |

## Resultado

Dos archivos:

- `Madrid.xlsx` — contiene las filas de Acme + Coreon.
- `Barcelona.xlsx` — contiene Beta.

## Agrupación por múltiples claves

```text
output_file_pattern = {{ [Region] }}-{{ [Categoria] }}.xlsx
```

La clave de grupo pasa a ser la tupla `(Region, Categoria)`. Tuplas distintas → archivos distintos. `Madrid-A.xlsx`, `Madrid-B.xlsx`, `Barcelona-A.xlsx`, etc.

## Saneado del nombre de archivo

xl3 sanea los nombres de archivo según ADR-0002: cada carácter prohibido de `/ \ : * ? " < > |` (más los caracteres de control) se sustituye por `_` uno a uno, y después se recortan los espacios iniciales y los puntos/espacios finales. Las secuencias de `_` **no** se colapsan. Si dos valores de grupo distintos se sanean al mismo nombre de archivo — `Madrid/España` y `Madrid:España` quedan ambos como `Madrid_España.xlsx` (cada carácter prohibido se convierte en un `_`) — xl3 lanza `xl3/filename/collision` según ADR-0031 en lugar de sobrescribir silenciosamente.

## Clave de grupo vacía

Si una fila tiene el valor de la clave de grupo vacío, xl3 sustituye por el literal `(blank)` según la convención de tablas dinámicas de Excel (ADR-0026). El archivo se llama `(blank).xlsx`.

## Notas

- El orden de los archivos es "primero en aparecer" según ADR-0016 — el orden en que aparecen las filas en el origen.
- Para agrupar por hojas (una hoja por región dentro de un archivo) consulta la [Receta 05](./05-sheet-per-group.md).
