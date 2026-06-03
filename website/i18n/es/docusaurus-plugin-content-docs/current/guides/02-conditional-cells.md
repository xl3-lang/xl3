---
sidebar_label: '02 · Celdas condicionales'
pagination_label: '02 · Celdas condicionales'
---

# 02 · Celdas condicionales

## Escenario

Mostrar valores distintos en la celda según los datos de la fila. Hay dos patrones: elegir entre dos valores (`IF`) y sustituir cuando el origen está vacío (`IFEMPTY`).

## `IF` — elegir entre dos valores

```text
{{ IF([Renovacion] > 10000, "Prioritario", "Estandar") }}
{{ IF([Region] = "Madrid", "Local", "Remoto") }}
{{ IF([Responsable] != "", [Responsable], "Sin asignar") }}
```

Operadores de comparación: `=`, `!=`, `>`, `<`, `>=`, `<=`. El tercer argumento (la rama "else") es obligatorio — XTL no tiene una rama vacía implícita.

## `IFEMPTY` — sustituir cuando el valor falta

```text
{{ IFEMPTY([Responsable], "Sin asignar") }}
{{ IFEMPTY([Nota], "—") }}
```

`IFEMPTY(value, fallback)` devuelve `fallback` cuando `value` está vacío (ausente, null o una cadena con solo espacios). El número `0` y `false` **no** se consideran vacíos — para esos casos usa `IF`.

## Reglas de verdad (condición de `IF`)

- Los valores **vacíos** (ausentes, cadenas con solo espacios) son falsos.
- Las cadenas `"0"` y `"false"` son **verdaderas** — son cadenas no vacías y punto. Si quieres tratar `"0"` como falso, compara explícitamente: `IF([Importe] != "0", ...)`.
- El número `0` y el booleano `false` son falsos.
- Las fechas siempre son verdaderas.

## Combinar con `&` para texto derivado

```text
{{ "Cat-" & IF([Renovacion] > 10000, "A", "B") & "-" & [Region] }}
```

`&` es el operador de concatenación de cadenas. Los operandos se convierten a su forma canónica (véase [`spec/language.md`](/es/spec/language), "Canonical String Form").

## Notas

- `=` y `!=` aplican el fallthrough de comparación de XTL: numérica si ambos lados son número o cadena numérica, booleana entre booleanos, marca de tiempo entre fechas, y orden por punto de código Unicode en el resto. No hay ordenación por configuración regional.
- `IF` puede anidarse: `IF(a, "X", IF(b, "Y", "Z"))`. Es familiar para usuarios de Excel; los anidamientos muy profundos son difíciles de leer — conviene dividir en celdas auxiliares o precalcular en el origen.
