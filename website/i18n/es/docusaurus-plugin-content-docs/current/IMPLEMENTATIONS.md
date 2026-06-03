# Implementaciones de XTL

Implementaciones de la [especificación XTL](./spec/). xl3 es la implementación de referencia.

| Lenguaje | Repo | Paquete | Versión de la especificación | Conformidad | Notas |
|---|---|---|---|---|---|
| TypeScript | [`jinyoung4478/xl3`](https://github.com/jinyoung4478/xl3) | [`@jinyoung4478/xl3`](https://www.npmjs.com/package/@jinyoung4478/xl3) | XTL 0.1 (borrador) | referencia; pasan **139/139** fixtures (133 solo Stage 1 + 6 solo Stage 2) | Navegador + Node ≥ 20.12; runner vía `npx xl3-conformance`; matriz de 3 zonas horarias en CI |
| Python | [`jinyoung4478/xl3-py`](https://github.com/jinyoung4478/xl3-py) | _(sin publicar)_ | XTL 0.1 (borrador) | **borrador**, en desarrollo | Se rastrea junto a la implementación de referencia; deja un artefacto `--report=json` bajo [`conformance/reports/`](./conformance/reports/) y `npm run conformance:dashboard` lo recoge |

## Añadir una implementación

Lee primero [`PORTERS_GUIDE.md`](/es/porters-guide) — distingue los
requisitos normativos de la especificación de los detalles incidentales
de la implementación TS y propone un orden de desarrollo recomendado
ligado al corpus de conformidad.

Para listar un portado aquí:

1. Implementa lo suficiente de XTL 0.1 para pasar los [fixtures de conformidad](./conformance/fixtures/) que tengas como objetivo.
2. Ejecuta tu implementación contra [`conformance/`](./conformance/) siguiendo [`conformance/runner-protocol.md`](/es/conformance/runner-protocol).
3. Abre un PR añadiendo una fila a la tabla de arriba con: lenguaje, URL del paquete, versión de la especificación objetivo, estado de conformidad (full / partial / N de M fixtures).

Los portados en desarrollo activo son bienvenidos — enlaza tu repo en
progreso aunque la conformidad sea parcial.

## Niveles de cumplimiento de la especificación

- **reference** — esta implementación. Por definición conforme para su versión de especificación declarada.
- **full** — pasa todos los fixtures de conformidad para la versión de especificación declarada.
- **partial (N/M)** — pasa N de M fixtures. Lista las categorías de fixtures que aún no soporta.
- **draft** — WIP temprano, todavía no ejecuta la conformidad.
