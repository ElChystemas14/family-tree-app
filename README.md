# Archivo Hawthorne — Árbol genealógico (`family-tree-app`)

App local-first (sin backend) para explorar y editar el árbol genealógico familiar
en un canvas interactivo. Interfaz en español, canvas como pantalla principal y
datos de prueba de la familia Hawthorne.

## Requisitos

- Node.js 20+ (probado con Node 24) y **pnpm** como único gestor
  (`packageManager: pnpm@11` en `package.json`; actívalo con `corepack enable` si hace falta).

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). La primera carga muestra el
dataset Hawthorne; tus cambios se guardan en `localStorage` (`hawthorne-tree-v1`)
y sobreviven recargas.

## Scripts

| Script                              | Qué hace                                            |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Servidor de desarrollo                              |
| `pnpm build` / `pnpm start`         | Build de producción / servirlo                      |
| `pnpm lint`                         | ESLint                                              |
| `pnpm typecheck`                    | `tsc --noEmit`                                      |
| `pnpm test`                         | Vitest (lógica de fechas, validación, persistencia) |
| `pnpm format` / `pnpm format:check` | Formatear con Prettier / comprobar formato          |

## Estructura de `src/`

- `app/` — ruta única `/` (`page.tsx` renderiza el canvas) y `layout.tsx` (español, tema, metadatos).
- `components/family-tree/` — `family-tree-canvas.tsx` (estado + React Flow),
  `person-node.tsx`, `union-node.tsx`, `tree-controls.tsx`, `person-detail-sheet.tsx`,
  `add-relative-modal.tsx`.
- `components/ui/` — primitivas shadcn/base-ui.
- `lib/family-tree/` — `dates.ts` (parseo local `YYYY-MM-DD`, nunca UTC),
  `schema.ts` (validación zod + mensajes en español), `storage.ts` (persistencia
  versionada + export/import JSON), `transform.ts` (dagre → grafo),
  `mock-data.ts` (dataset Hawthorne + relaciones).
- `types/family-tree.ts` — `Person`, `Union`, `ChildRelationship`, `FamilyTreeData`.
- `i18n/` — `config.ts` (locales, `es` por defecto) y `messages/es.json` (catálogo
  `next-intl`; añadir idioma = añadir archivo).

## Modelo de datos (resumen)

- **Person**: `id`, `firstName`, `lastName`, `gender`, `birthDate?` (`YYYY-MM-DD`,
  opcional), `deathDate?` (≥ nacimiento), `photoUrl?` (solo `https://` o ruta `/`),
  `bio?`. La adopción vive en la relación, no en la persona.
- **Union**: `id`, `partner1Id`, `partner2Id` (distintos), `unionType`
  (`marriage` | `partnership` | `domestic`), `startDate?`/`endDate?`.
- **ChildRelationship**: `id`, `childId`, `unionId` **o** `singleParentId`
  (excluyentes), `type` (`biological` | `adopted` | `step`).
- **Formato canónico JSON**: `{ version: 1, persons, unions, relationships,
posOverrides? }` — es lo que se guarda en local y lo que se exporta/importa
  (`arbol-AAAA-MM-DD.json`).

## Documentación del proyecto

El mapa completo está en [`docs/`](docs/):

- [`docs/audit.md`](docs/audit.md) — auditoría inicial y hallazgos (`AUD-*`).
- [`docs/roadmap.md`](docs/roadmap.md) — plan por fases con seguimiento (Fases A–D
  hechas; D solo diseño, v1.0 local-first lista).
- [`docs/ideas.md`](docs/ideas.md) — ideas futuras aparcadas (`IDEA-*`).
- [`docs/decisions.md`](docs/decisions.md) — decisiones tomadas.
- [`docs/guides/`](docs/guides/) — guías de ejecución por fase y formato CSV.

Todo el trabajo es local: commits y ramas en local, sin push hasta indicación
contraria (ver `decisions.md`).
