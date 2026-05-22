# Autoría de fixtures de conformidad

El corpus de este directorio se convierte en la definición ejecutable de XTL. Los fixtures codificados aquí sobreviven a cualquier implementación individual. Crearlos bien importa más que crear muchos.

## El antipatrón "implementación JS como verdad absoluta"

El atajo tentador es:

1. Ejecutar la implementación de referencia JS
2. Guardar su salida como `expected.xlsx`
3. Hacer commit y llamarlo canónico

Esto convierte a la implementación JS en la especificación de facto. Cuando un port en Python o Go discrepa, ¿quién tiene razón? Quien se haya ejecutado primero. La especificación se convierte en "lo que hace la implementación JS" y la estandarización muere.

**La conformidad debe escribirse a partir de la especificación, no de la implementación.**

## Procedimiento de autoría

### Para fixtures sencillos

1. Lee la sección relevante de [`spec/`](../spec/).
2. Escribe `template.xlsx` y `data.xlsx` a mano en Excel (o un editor de hojas de cálculo).
3. Calcula la salida esperada **a mano** — abre Excel, abre una calculadora, trabaja celda por celda. Guarda como `expected.xlsx`.
4. Ejecuta la implementación de referencia. Si discrepa con tu valor esperado calculado a mano, **no** cambies el valor esperado — abre una issue: o la especificación está mal, o la implementación está mal, o tu cálculo manual está mal.

### Para fixtures complejos

Cuando el cálculo manual es impractical (p. ej., sumas de 200 filas, agrupaciones multi-hoja):

1. Crea plantilla y datos siguiendo la especificación.
2. Calcula el esperado por dos rutas independientes (p. ej., fórmulas de Excel + un script separado). Deben coincidir.
3. Ejecuta la implementación de referencia; si coincide con ambas rutas independientes, guarda la salida de la implementación como esperada.
4. Documéntalo en `meta.yaml`: `verified_by: [excel-formulas, manual-script]`.

### Qué debe contener `meta.yaml`

```yaml
description: "Basic per-row substitution with [field] syntax"
spec_section: "Cell-level variables"
spec_version: 0.1
tags: [substitution, basic]
comparison_stage: 1
verified_by: [hand]            # o [excel-formulas, manual-script], etc.
```

`comparison_stage` es opcional y toma por defecto `1`. Usa `2` solo para
fixtures de salida estática que necesiten comparación canónica de OOXML para
verificar estilos, rangos combinados, imágenes, estructura del paquete u otras
características del libro que la comparación de valores de celda de la etapa 1
no puede observar.

`expected_error` convierte el fixture en un fixture de error y no debe usarse
con `expected.xlsx`, `expected/` ni `expected_dynamic`. `expected_dynamic`
convierte el fixture en un fixture de aserción dinámica y debe incluir
`dynamic_cells`; los fixtures dinámicos también omiten las salidas estáticas
esperadas. Mantén `comparison_stage` solo para fixtures de salida estática.

### Advertencia sobre autoría de fixtures de etapa 2

Tanto `template.xlsx` como `expected.xlsx` para la mayoría de los fixtures actuales
de etapa 2 (024-026) se construyen con el mismo escritor `exceljs` que la
implementación de referencia JS usa internamente. Hacen round-trip a través de una
sola librería en ambos lados, por lo que ejercitan la afirmación de *equivalencia*
del canonicalizador (renombrado de partes de hoja, eliminación de page setup por
defecto, orden de atributos, estilo de comillas, forma de elementos vacíos) pero
no su afirmación *cross-writer*. Un canonicalizador que solo gestione las rarezas
de ExcelJS aún pasará esos fixtures.

El fixture 027 añade cobertura de varianza de escritor a nivel de paquete
reescribiendo a mano la serialización OOXML del libro esperado escrito a mano,
manteniendo la misma semántica del libro. Esto sigue sin ser un sustituto de un
libro guardado por Excel, LibreOffice u otro escritor OOXML independiente; tal
fixture sigue siendo el siguiente paso preferido cuando ese entorno de autoría
esté disponible.

La regla cardinal sigue aplicándose: un `expected.xlsx` de etapa 2 creado
ejecutando la implementación JS está prohibido. La autoría con ExcelJS es
aceptable solo como andamiaje porque el escritor del paquete es genérico — no es
la implementación de XTL. Añadir un fixture de etapa 2 cuyo `expected.xlsx` esté
guardado por Excel mismo (u otro escritor OOXML) sigue siendo un seguimiento más
fuerte; hasta entonces, el comportamiento cross-writer se cubre con la
reescritura de paquete del fixture 027 más los tests unitarios del canonicalizador
en `src/__tests__/conformance-runner.test.ts`.

Para los fixtures de error, omite `expected.xlsx` y `expected/`, y declara la
parte estable del diagnóstico esperado:

```yaml
expected_error: "Source sheet"
```

Para los fixtures dinámicos, omite `expected.xlsx` y `expected/`, declara el tipo
de aserción dinámica y lista las celdas cuyos valores esperados son calculados
por el ejecutor:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

## Reglas estrictas

- **Las salidas esperadas se escriben, no se generan.** Si no puedes verificar a mano, debes verificar independientemente. Trata `expected.xlsx` como parte de la especificación, no como salida de prueba.
- **Cada fixture prueba un único concepto.** Mezclar repeat + filter + agregación en un mismo fixture hace que los fallos sean difíciles de diagnosticar. Compón fixtures mínimos.
- **Los tamaños de archivo del fixture deben ser muy pequeños.** Si un fixture necesita 1000 filas de datos, el concepto a probar está mal — genera datos pequeños que ejerciten la misma propiedad.
- **Sin PII ni datos propietarios.** Los fixtures tienen licencia MIT y son públicos. Usa solo datos sintéticos.
- **Las plantillas deben ser legibles por humanos.** Evita características de Excel solo binarias (XML personalizado, macros) en fixtures, salvo que estés probándolas explícitamente.
- **Los fixtures de error solo verifican diagnósticos estables.** Coincide con un
  substring corto que describa el contrato, no con detalles volátiles como rutas
  absolutas.
- **Los fixtures dinámicos solo verifican valores dinámicos definidos por la especificación.**
  No los uses para evitar crear un libro esperado para comportamiento estático.

## Cuando la especificación y un fixture discrepan

Gana la especificación. Actualiza el fixture.

## Cuando un fixture y una implementación discrepan

Gana el fixture. Actualiza la implementación.

## Cuando descubres un caso poco especificado durante la autoría

Detente. Abre una issue y actualiza la especificación primero. No hagas commit de un fixture que dependa de comportamiento poco especificado — eso congela la sub-especificación como "lo que hace el corpus", que la especificación luego tendría que igualar retroactivamente.
