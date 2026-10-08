# Archivo Hawthorne — Árbol genealógico (`family-tree-app`)

App local-first para explorar y editar el árbol genealógico familiar en un
canvas interactivo, con nube opcional (Supabase) para multiusuario. Interfaz en
español, canvas como pantalla principal y arranque vacío con onboarding.

## Requisitos

- Node.js 20+ (probado con Node 24) y **pnpm** como único gestor
  (`packageManager: pnpm@11` en `package.json`; actívalo con `corepack enable` si hace falta).

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). La primera carga arranca
vacía con onboarding; tus cambios se guardan en `localStorage` (`hawthorne-tree-v1`)
y sobreviven recargas.

## Nube opcional (Supabase, Fase E)

Sin esto la app es 100% local. Para el login multiusuario, crea `.env` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_publishable_key
```

(sin comillas; está gitignorado) y ejecuta `supabase/migrations/0001_multiuser.sql`
en el SQL editor del dashboard. La `DB_PASSWORD` no la usa la app: guárdala aparte.

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
  hechas; E en curso: multiusuario con Supabase).
- [`docs/ideas.md`](docs/ideas.md) — ideas futuras aparcadas (`IDEA-*`).
- [`docs/decisions.md`](docs/decisions.md) — decisiones tomadas.
- [`docs/guides/`](docs/guides/) — guías de ejecución por fase y formato CSV.

Todo el trabajo es local: commits y ramas en local, sin push hasta indicación
contraria (ver `decisions.md`).
