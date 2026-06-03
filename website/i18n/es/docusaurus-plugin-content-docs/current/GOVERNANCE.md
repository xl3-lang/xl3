# Gobernanza

Cómo se toman las decisiones para la especificación XTL y la implementación de referencia xl3.

Este documento es intencionadamente corto. Describe el estado actual del
proyecto (un único mantenedor, fase formativa) y el camino hacia una
gobernanza multilateral a medida que crece la adopción.

## Estado actual

xl3 está en su **fase formativa**. Un único mantenedor es:

- El autor de `src/` (implementación de referencia en TypeScript)
- El editor de `spec/` (definición del lenguaje XTL)
- Quien acepta los [ADR](./spec/decisions/) en `spec/decisions/`
- El revisor de todos los PR

Esto es normal para un proyecto en esta etapa. Las estructuras de abajo
describen cómo entran las decisiones en el proyecto y qué cambia a
medida que se incorporan más contribuidores.

## Roles

| Rol | Responsabilidad | Quién |
|---|---|---|
| **Mantenedor** | Aceptación/rechazo final de ADR y PR de implementación. Corta releases. | Actualmente, el autor del proyecto. |
| **Editor de spec** | Redacta ADR, edita `spec/language.md` y `spec/evaluation.md`. | El mantenedor por ahora. |
| **Autor de portado** | Implementa XTL en otro lenguaje; ejecuta la conformidad contra [`conformance/fixtures/`](./conformance/fixtures/). | Cualquiera. Se listan en [IMPLEMENTATIONS.md](/es/implementations). |
| **Contribuidor** | Abre issues, envía PR, propone fixtures o ADR. | Cualquiera. Ver [CONTRIBUTING.md](/es/contributing). |

El conjunto de mantenedores crece cuando contribuidores externos revisan
y aterrizan cambios de forma sostenida. No existe un proceso formal de
votación — el mantenedor se compromete a ampliar el conjunto de
mantenedores cuando tenga sentido, y a documentar el momento en que lo
haga.

## Cómo entran los cambios en el proyecto

### Bug de implementación / aclaración menor de la especificación

- Abre una issue o envía un PR directamente.
- Lo revisa el mantenedor.
- Se fusiona cuando (a) no cambia el comportamiento normativo de la
  especificación o (b) es una aclaración trivialmente correcta.

### Cambio normativo de la especificación (nuevo comportamiento, cambio de comportamiento existente)

Los cambios de especificación siguen el **proceso de ADR**:

1. **Descubrimiento** — un caso límite real (en uso, al escribir un
   fixture, en un portado) revela que la especificación está en
   silencio o es ambigua.
2. **Issue** — abre una issue `spec` describiendo el hueco, las
   alternativas y las referencias cruzadas relevantes.
3. **Borrador de ADR** — el mantenedor (o el contribuidor) redacta un
   ADR en [`spec/decisions/`](./spec/decisions/) siguiendo la plantilla
   en `spec/decisions/0000-template.md`. Incluye Contexto, Opciones
   consideradas, Decisión, Consecuencias, Referencias.
4. **Revisión** — la discusión ocurre en el PR que introduce el ADR. El
   listón para aceptar es "la justificación es suficiente para que un
   segundo implementador llegue a la misma decisión sin leer el código
   fuente de la implementación".
5. **Aceptación** — `status: accepted` se establece cuando:
   - Al menos un fixture de conformidad demuestra el nuevo
     comportamiento, Y
   - El cambio en la implementación de referencia se incluye en el mismo
     PR (o en un PR de seguimiento aterrizado antes del release), Y
   - El mantenedor da el visto bueno.
6. **Release** — la siguiente versión menor sube la versión de la
   especificación si el cambio es aditivo, mayor si es incompatible.

Los ADR en [`spec/decisions/`](./spec/decisions/) son el registro
público del proyecto de cada decisión normativa y el razonamiento detrás
de ella.

### Adiciones de fixtures de conformidad

Los fixtures son lo que hace que XTL sea _ejecutable_. Los nuevos
fixtures amplían el corpus:

1. Abre una issue o sigue la plantilla de **propuesta de fixture**.
2. Escribe el fixture siguiendo [`conformance/AUTHORING.md`](/es/conformance/authoring).
   La regla cardinal: **las salidas esperadas vienen de la
   especificación, no de ejecutar la implementación de referencia.**
3. Envía un PR.
4. El mantenedor revisa. La aprobación es más rápida que para los ADR
   porque los fixtures restringen menos — documentan una regla existente
   de la especificación en vez de crear una.

## Compromisos de compatibilidad hacia atrás

| Superficie | Promesa de estabilidad |
|---|---|
| Spec `XTL 1.0` (cuando se corte) | Los cambios incompatibles requieren `XTL 2.0` con guía de migración |
| Spec `XTL 0.x` (actual) | Se permiten cambios incompatibles; sube la menor; envía actualizaciones de fixtures junto con el cambio |
| `xl3` npm `1.x` (cuando se corte) | API pública congelada en el snapshot de `src/__tests__/api-surface.test.ts`. Renombrar o eliminar requiere un bump mayor |
| `xl3` npm `0.x` (actual) | La API pública puede cambiar; el test de snapshot detecta deriva accidental |
| Códigos de error (`xl3/<categoría>/<id>`) | Solo se añade. Renombrar es incompatible. Eliminar requiere un bump mayor |

## Desacuerdos

El desacuerdo técnico es sano. La ruta de resolución:

1. Discútelo en la issue/PR con compensaciones concretas.
2. Si no emerge consenso, el mantenedor toma una decisión y la
   documenta en la sección de Consecuencias del ADR.
3. Un ADR futuro puede revisitar y reemplazar a uno anterior. Los ADR
   no son inmutables; registran el razonamiento en un punto del tiempo.
   Cuando un ADR posterior reemplaza a uno anterior, el anterior se
   marca como `status: superseded` con un puntero al sucesor.

Es intencionadamente un proceso con poca ceremonia. A medida que crezca
el número de contribuidores, esta sección necesitará expandirse
(votación, periodos de RFC, comité técnico de dirección, etc.). El
mantenedor se compromete a que esa expansión ocurra públicamente.

## Cómo influir en el proyecto hoy

Las maneras más efectivas de influir en xl3:

1. **Úsalo en producción y reporta lo que falta.** La adopción real es
   la señal más fuerte sobre qué priorizar.
2. **Propón un fixture.** Un nuevo fixture obliga a que la
   especificación sea más clara que la prosa por sí sola. Incluso las
   propuestas de fixture no aceptadas suelen disparar mejoras en la
   especificación.
3. **Porta a un segundo lenguaje y ejecuta el corpus de conformidad.**
   Una segunda implementación independiente encuentra huecos en la
   especificación más rápido que cualquier revisión. Ver
   [PORTERS_GUIDE.md](/es/porters-guide).
4. **Abre un borrador de ADR sobre un elemento diferido.** Los elementos
   diferidos en [`spec/decisions/`](./spec/decisions/) (aritmética de
   fechas, collation con locale, multi-join, etc.) son candidatos para
   futuros ADR — las propuestas concretas son bienvenidas.

## Cómo evoluciona este documento

Cuando se amplíe el conjunto de mantenedores, este documento se
reescribe para reflejar el nuevo estado — incluyendo cualquier proceso
de votación / RFC / TSC adoptado. Hasta entonces, esta es la
descripción operativa.
