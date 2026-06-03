# Contribuir a xl3

xl3 es la implementación de referencia en TypeScript de la [especificación XTL](./spec/). Este archivo cubre las rutas de contribución tanto para la implementación como para la especificación.

Durante la fase 0.x, el proyecto lo mantiene un único autor. Las contribuciones son bienvenidas, pero el listón para cambios en la especificación es alto — XTL aspira a ser un estándar estable e independiente del lenguaje.

Ver [GOVERNANCE.md](/es/governance) para entender cómo se toman las
decisiones y [ROADMAP.md](/es/roadmap) para ver qué bloquea el corte
1.0.

## Inicio rápido

```bash
git clone https://github.com/jinyoung4478/xl3.git
cd xl3
npm install
npm test
```

## Tres tipos de contribución

### 1. Bugs de implementación (este repositorio, `src/`)

Los bugs de la implementación de referencia que discrepan con la
especificación siempre son bienvenidos. Pasos:

1. Abre una issue con una reproducción mínima (template.xlsx + data.xlsx + salida observada vs. esperada).
2. Si tienes una corrección, envía un PR con un test de regresión en `src/__tests__/`.

Si el bug es "la implementación encaja con la especificación pero la especificación está mal", ver (3).

### 2. Preguntas y aclaraciones sobre la especificación (`spec/`)

La especificación es normativa. Si encuentras un comportamiento poco
especificado:

1. Abre una issue etiquetada `spec`.
2. Si la respuesta es pequeña (errata, aclaración), un PR es bienvenido.
3. Si la respuesta requiere una decisión de diseño, el mantenedor redactará un ADR en [`spec/decisions/`](./spec/decisions/).

### 3. Fixtures de conformidad (`conformance/fixtures/`)

El corpus de conformidad es la definición ejecutable de XTL. Los fixtures que viven aquí sobreviven a cualquier implementación concreta. **Lee [`conformance/AUTHORING.md`](/es/conformance/authoring) antes de escribir uno.**

La regla cardinal: **las salidas esperadas se redactan a partir de la especificación, no se generan desde la implementación JS.** Un fixture que solo registra lo que hace la implementación JS congela esa implementación como la especificación de facto — exactamente lo que XTL intenta evitar.

### 4. Portados a otros lenguajes

Las implementaciones en otros lenguajes son bienvenidas y se llevan en [IMPLEMENTATIONS.md](/es/implementations). Para listar un portado:

1. Implementa contra la especificación, no contra la implementación JS.
2. Ejecuta tu implementación a través del corpus de conformidad siguiendo [`conformance/runner-protocol.md`](/es/conformance/runner-protocol).
3. Abre un PR añadiendo una fila a `IMPLEMENTATIONS.md`.

## Convenciones de código (implementación TypeScript)

- El modo strict de TypeScript está activo; los PR deben pasar el typecheck (`npm run typecheck`).
- Los tests están en `src/__tests__/`. Ejecútalos con `npm test`.
- Las funcionalidades nuevas necesitan tests. Las correcciones de bugs necesitan tests de regresión.
- Evita añadir dependencias en runtime salvo que sea necesario. Dependencias actuales: `exceljs`, `jszip`.

## Mensajes de commit

Usa [Conventional Commits](https://www.conventionalcommits.org/) cuando aplique:

- `feat:` — nueva funcionalidad en la implementación
- `fix:` — corrección de bug en la implementación
- `spec:` — cambio en el texto de la especificación bajo `spec/`
- `conformance:` — cambio en el corpus de fixtures o en el protocolo del runner
- `docs:` — README, CONTRIBUTING, etc.
- `chore:` — tooling, CI, dependencias
- `test:` — cambio solo de tests en la implementación

Los cambios incompatibles llevan `!` (p. ej., `feat!: rename count to rowcount`).

## Cambios de especificación durante 0.x

Los cambios incompatibles de especificación se permiten en 0.x pero deben:

1. Estar motivados por un ADR en [`spec/decisions/`](./spec/decisions/) con `status: accepted`.
2. Subir la versión menor de la especificación (`0.1` → `0.2`).
3. Aterrizar junto con actualizaciones de fixtures en `conformance/fixtures/`.

Después de 1.0, los cambios incompatibles de especificación requieren XTL 2.0 con guía de migración.

## Releasing (solo mantenedor)

1. Resuelve todos los ADR en curso apuntados al release.
2. Actualiza `CHANGELOG.md`.
3. Sube la versión en `package.json`.
4. `npm publish` (encerrado por `prepublishOnly` ejecutando typecheck + tests + build).
5. Etiqueta el commit (`git tag v0.1.0 && git push --tags`).

## Buenas primeras contribuciones

Si quieres contribuir pero no tienes un escozor concreto, estas son las
cosas con más palanca que puedes coger. Cada una mapea a un bloqueador
de 1.0 en [ROADMAP.md](/es/roadmap).

1. **Propón un fixture de conformidad** para una regla de la
   especificación que aún no tenga uno. Usa la plantilla de issue
   **"Conformance fixture proposal"**. No necesitas TypeScript para
   escribir el fixture en sí — solo el `template.xlsx` + `data.xlsx` +
   la salida esperada (o el error esperado).
2. **Traducción de guías.** Elige una de las 15 recetas en
   [`docs/guides/`](./docs/guides/) y tradúcela al coreano (o a
   cualquier otro idioma). Deja el archivo en
   `docs/guides/<lang>/NN-*.md` y abre el PR. Baja coordinación, alto
   valor.
3. **Ejecuta xl3 con datos reales de informes y reporta fricciones.** Una
   issue corta etiquetada `early-adopter-feedback` con: qué informe
   intentaste, qué funcionó, qué no, qué te habría gustado que XTL
   tuviera. Esto da forma a qué entra en 1.0.
4. **Aclaración de especificación.** Si lees la especificación y
   encuentras una frase ambigua, abre una issue etiquetada `spec` con
   la frase ofensora + dos interpretaciones razonables. Incluso los
   reportes no aceptados suelen disparar mejoras en la especificación.
5. **Progreso de portado.** ¿Trabajando en
   [xl3-py](https://github.com/jinyoung4478/xl3-py) u otro portado?
   Deja un archivo `conformance/reports/<impl>-<version>.json`
   (formato documentado en
   [`conformance/runner-protocol.md`](/es/conformance/runner-protocol))
   y el dashboard te incluye automáticamente.

## Código de conducta

Sé respetuoso. Se da la bienvenida al desacuerdo sobre decisiones técnicas; los ataques personales no.
