# Auditoría — family-tree-app (inicial + revisión final)

- **Fecha**: 2026-09-20; revisión intermedia 2026-10-07; **revisión final 2026-10-07** (esta).
- **Alcance final**: código en `master` hasta `5700a33` (40 commits), configuración, documentación y repo.
- **Método**: lectura de fuentes, ejecución (`tsc`, `eslint`, `build`, `test` en 2 TZ),
  pruebas de comportamiento, greps de verificación (claves i18n, literales, TODOs) e
  inspección de dependencias instaladas.
- **Veredicto final**: v1.0 local-first lista (~8.2/10). Pendiente: push + CI en remoto,
  matriz manual completa y endurecimiento `AUD-LOW-05`. Detalle en
  [`#revisión-final-2026-10-07-estado`](#revisión-final-2026-10-07-estado).

## Notas por área (revisión final)

| Área                 | Inicial | Final | Resumen final                                                               |
| -------------------- | ------- | ----- | --------------------------------------------------------------------------- |
| Arquitectura         | 6/10    | 8/10  | Store extraído, layout memoizado, adapter previsto en diseño D; sin backend |
| Diseño UI/UX         | 7/10    | 8/10  | Onboarding, dark persistente sin flash, táctil resuelto, i18n UI            |
| Calidad de código    | 6/10    | 8/10  | 55 tests, tipos+lint verdes, Prettier; canvas grande (1020 líneas)          |
| Configuración/DevOps | 5/10    | 7/10  | pnpm único, README real, CI creada sin ejecutar (sin remoto)                |
| Seguridad/Privacidad | 6/10    | 7/10  | Validación + RLS diseñado; `AUD-LOW-05` pendiente; sin auth por diseño      |
| Rendimiento          | 7/10    | 8/10  | dagre por estructura+modo; sin problemas a escala familiar                  |

## Hallazgos

Formato de ID: `AUD-<SEVERIDAD>-<NN>`. Severidades: CRIT (bloquea uso real o corrompe datos),
HIGH (deuda que frena el desarrollo), MED (mejora con coste bajo), LOW (higiene).

### Críticos

#### AUD-CRIT-01 — Fechas desplazadas un día por parseo UTC

- **Ubicación**: `src/lib/family-tree/mock-data.ts` (`formatDate`, `formatYear`).
- **Evidencia**: `new Date("1954-08-17")` se interpreta como medianoche UTC; al formatear
  en hora local (p. ej. UTC-5) devuelve **"16 ago 1954"**. Reproducido por ejecución.
- **Impacto**: todas las fechas mostradas en fichas pueden estar un día antes (y el año
  falla en el borde 1 de enero).
- **Fix**: parsear como fecha local (`new Date(y, m - 1, d)`), centralizar en un helper
  de fechas y añadir tests con zona horaria fija.
- **Roadmap**: Fase A (`guides/phase-a-data-integrity.md`).

#### AUD-CRIT-02 — Sin persistencia: todo se pierde al recargar

- **Ubicación**: estado en memoria en `src/components/family-tree/family-tree-canvas.tsx`.
- **Impacto**: bloquea el objetivo "uso personal/familiar" real.
- **Fix**: persistencia local-first (`localStorage` versionado) + export/import JSON.
- **Roadmap**: Fase A (`guides/phase-a-data-integrity.md`).

### Altos

#### AUD-HIGH-01 — Lockfiles duplicados y contradictorios

- **Ubicación**: `package-lock.json` + `pnpm-lock.yaml` (ambos trackeados).
- **Evidencia**: el `package-lock` está obsoleto (no contiene `@vercel/analytics`);
  el proyecto declara `packageManager: pnpm`.
- **Fix**: borrar `package-lock.json` y documentar pnpm como única herramienta.
- **Roadmap**: Fase A.

#### AUD-HIGH-02 — Cero tests

- **Ubicación**: no existe ni carpeta de tests.
- **Impacto**: `transform.ts`, helpers de parentesco y validaciones no tienen red de seguridad.
- **Fix**: Vitest con cobertura en lógica pura (`transform`, parentesco, validaciones, serialización).
- **Roadmap**: Fase B (`guides/phase-b-product-quality.md`).

#### AUD-HIGH-03 — Sin validación de datos

- **Ubicación**: formularios en `add-relative-modal.tsx` y edición en `family-tree-canvas.tsx`.
- **Impacto**: fechas vacías/incoherentes (muerte anterior al nacimiento), nombres sin
  normalizar; imprescindible antes del import CSV.
- **Fix**: esquema zod central para Persona/Unión/Relación + validación en UI y en importación.
- **Roadmap**: Fase A (base) y Fase C (importación) (`guides/phase-c-data-exchange.md`).

#### AUD-HIGH-04 — README genérico de create-next-app

- **Ubicación**: `README.md`.
- **Fix**: documentar setup (pnpm), scripts, estructura, modelo de datos y enlaces a `docs/`.
- **Roadmap**: Fase A.

#### AUD-HIGH-05 — `getFamilyRelationships` lee el dataset estático, no el estado vivo (nuevo 2026-10-07)

- **Ubicación**: `src/lib/family-tree/mock-data.ts:46-47` (`const { persons, unions,
relationships } = familyTreeData`), consumido en
  `src/components/family-tree/person-detail-sheet.tsx:9,15`.
- **Evidencia**: tras `addPerson`/`connectPeople` en `family-tree-canvas.tsx` el
  `PersonDetailSheet` sigue mostrando padres/parejas/hijos del dataset Hawthorne
  original, no los recién creados.
- **Fix**: hacer la función pura (`getFamilyRelationships(personId, data)`) y pasarle
  el estado del store; a largo plazo moverla junto al store (B1).
- **Roadmap**: Fase A (hacerla pura + tests) y Fase B (moverla al store).

#### AUD-HIGH-06 — `Person.birthDate` requerido en tipos pero opcional en UI/CSV (nuevo 2026-10-07)

- **Ubicación**: `src/types/family-tree.ts:11` (`birthDate: string` obligatorio) vs
  `src/components/family-tree/add-relative-modal.tsx:23` (permite `''`) y
  `guides/csv-format.md` (`birthDate` no requerida).
- **Impacto**: el tipo miente; zod/A3 debe decidir la fuente de verdad.
- **Fix (recomendado)**: `birthDate?: string` opcional en `Person` + validación
  `YYYY-MM-DD` cuando esté presente; alinear CSV y formularios.
- **Roadmap**: Fase A (dentro de A3).

### Medios

#### AUD-MED-01 — CLI `shadcn` en `dependencies`

- **Ubicación**: `package.json:22`. Lastra la instalación de producción.
- **Fix**: mover a `devDependencies`. **Roadmap**: Fase A.

#### AUD-MED-02 — Fuente Geist Sans descargada sin uso (Geist Mono sí se usa)

- **Ubicación**: `src/app/layout.tsx:9-17` carga `Geist`, `Geist_Mono` e `Inter`;
  `src/app/globals.css:8-9` mapea `--font-mono` a `--font-geist-mono` (usada) pero
  `--font-geist-sans` no se referencia en ningún sitio (`--font-sans` resuelve a Inter).
- **Fix**: quitar solo `Geist Sans`, conservar `Geist_Mono` + `Inter`. **Roadmap**: Fase B.

#### AUD-MED-03 — Configuración de imágenes muerta

- **Ubicación**: `next.config.ts` (`remotePatterns: images.unsplash.com`).
- **Contexto**: no hay imágenes externas desde que las fotos pasaron a `public/`.
- **Fix**: eliminar, o mantener documentada si se prevé pegar URLs externas.
- **Roadmap**: Fase A.

#### AUD-MED-04 — dagre se re-ejecuta en cada selección/búsqueda

- **Ubicación**: memo de `graph` en `family-tree-canvas.tsx` (incluye `selected` en deps).
- **Impacto**: imperceptible a escala familiar; mala base al crecer.
- **Fix**: memoizar layout por estructura+modo y derivar resaltado aparte.
- **Roadmap**: Fase B.

#### AUD-MED-05 — Modo oscuro sin persistencia y con posible flash inicial

- **Ubicación**: `classList.toggle` en efecto en `family-tree-canvas.tsx`.
- **Fix**: persistir preferencia (p. ej. `next-themes` o clase temprana en `layout`).
- **Roadmap**: Fase B.

#### AUD-MED-06 — Conflicto táctil: arrastrar-para-conectar vs pan

- **Ubicación**: `onNodeDragStop` en `family-tree-canvas.tsx`.
- **Fix**: modo "conectar" explícito o desactivar drag-connect en táctil.
- **Roadmap**: Fase B.

#### AUD-MED-07 — `photoUrl` sin validar + flag `adopted` duplicado (nuevo 2026-10-07)

- **Ubicación**: `add-relative-modal.tsx:19` (texto libre `https://...`),
  `person-detail-sheet.tsx:14` (`AvatarImage src` directo), `mock-data.ts:17`
  (`attributes: { adopted: true }` en Nora cuando ya existe
  `relationships[].type: 'adopted'`).
- **Impacto**: URLs `javascript:`/rotas rompen avatar; doble fuente de verdad para adopción.
- **Fix**: en zod/A3 aceptar solo `https://` o ruta `/`; fuente de verdad = `relationship.type`,
  eliminar `attributes.adopted` (mantener `attributes` libre para ocupación, etc.).
- **Roadmap**: Fase A (dentro de A3).

#### AUD-MED-08 — Persistencia: hidratación SSR y cupo no especificados (nuevo 2026-10-07)

- **Ubicación**: futura A2 sobre `family-tree-canvas.tsx:47` (`useState(familyTreeData)`).
- **Impacto**: leer `localStorage` en render rompe hidratación; `QuotaExceededError`
  y modo privado deben manejarse sin crash.
- **Fix**: leer en `useEffect` tras montaje (estado inicial = Hawthorne), guardar con
  debounce + `try/catch` de cupo, avisar sin bloquear.
- **Roadmap**: Fase A (dentro de A2).

### Bajos

#### AUD-LOW-01 — Sin Open Graph, sitemap ni robots

- Bajo valor en una SPA de una ruta; gratis con Metadata API. **Roadmap**: Fase B.

#### AUD-LOW-02 — Sin CI

- **Fix**: GitHub Actions con `tsc` + `eslint` + `build` (+ tests en Fase B).
- **Roadmap**: Fase B.

#### AUD-LOW-03 — Verificar atribución XYFlow

- **Ubicación**: `src/components/family-tree/family-tree-canvas.tsx` (props del
  `<ReactFlow … proOptions={{ hideAttribution: true }}>`). Confirmado el 2026-10-07
  con lectura del fichero completo (el grep inicial truncó la línea kilométrica y
  pareció ausente por error).
- **Fix**: revisar términos/licencia para este uso; si no hay licencia Pro, quitar
  `hideAttribution` y dejar la atribución visible.
- **Roadmap**: Fase A (una línea de verificación, coste ~0).

#### AUD-LOW-04 — Archivos de una sola línea kilométrica (herencia v0)

- Dificultan revisión y debug. **Fix**: Prettier + formateo. **Roadmap**: Fase B.

#### AUD-LOW-05 — Export CSV sin neutralizar fórmulas (nuevo, revisión final)

- **Ubicación**: `src/lib/family-tree/serializeCsv` en `csv.ts` (solo entrecomilla;
  no trata celdas que empiezan por `=`, `+`, `-` o `@`).
- **Impacto**: bajo (requiere abrir el CSV en hoja de cálculo y una bio maliciosa
  o accidental tipo `=1+1`); inyección de fórmulas al exportar.
- **Fix propuesto**: al exportar, prefijar con `'` (o tab) las celdas que empiecen
  por esos caracteres y deshacerlo al importar; test con bio `=2+2`.
- **Roadmap**: post-v1.0 (`IDEA-18`).

## Revisión final 2026-10-07 — estado

Verificado con `pnpm install --frozen-lockfile`, `test` 55/55 en
`America/Lima` y `Pacific/Kiritimati`, `typecheck`, `lint`, `format:check` y
`build` en verde; greps de claves i18n (todas resuelven en `es.json`), cero
TODOs y resto de literales revisado.

| Hallazgo                                         | Estado                                              | Fase      |
| ------------------------------------------------ | --------------------------------------------------- | --------- |
| AUD-CRIT-01, AUD-CRIT-02                         | resuelto                                            | A1, A2    |
| AUD-HIGH-01, AUD-HIGH-04, AUD-MED-01, AUD-MED-03 | resuelto                                            | A4        |
| AUD-HIGH-02                                      | resuelto (55 tests)                                 | A1, B2    |
| AUD-HIGH-03                                      | resuelto                                            | A3, C2    |
| AUD-HIGH-05, AUD-HIGH-06, AUD-MED-07             | resuelto                                            | A3 (+ B1) |
| AUD-MED-02                                       | resuelto (solo `Geist Sans` fuera)                  | B4        |
| AUD-MED-04                                       | resuelto (layout+resaltado separados)               | B5        |
| AUD-MED-05, AUD-MED-06                           | resuelto y verificado manual                        | B4        |
| AUD-MED-08                                       | resuelto                                            | A2        |
| AUD-LOW-01                                       | resuelto                                            | B4        |
| AUD-LOW-02                                       | parcial (workflow creado, sin ejecutar: sin remoto) | B3        |
| AUD-LOW-03                                       | resuelto (atribución visible)                       | A4        |
| AUD-LOW-04                                       | resuelto (Prettier)                                 | B3        |
| AUD-LOW-05                                       | pendiente post-v1.0                                 | `IDEA-18` |

Desviaciones aceptadas: B1 pedía canvas < ~150 líneas y está en 1020 legibles
(lógica en el store; extraer diálogos → `IDEA-17`); C4 deja en español los
mensajes de `lib/` y el "Close" de primitivas shadcn. Residual pre-push:
ejecutar la CI en remoto, matriz manual claro/oscuro × móvil/escritorio y
flujo export→vaciar→import manual. `getImmediateRelatives` queda sin uso
(higiene menor, no bloquea).

## Mapa de archivos revisados (final)

- `src/components/family-tree/*` (6 archivos), `src/lib/family-tree/*` (9 módulos
  - 8 ficheros de test), `src/i18n/*`, `src/types/family-tree.ts`, `src/app/*`
    (incluye `robots.ts`, `sitemap.ts`), `src/components/ui/*` (17 primitivas).
- `package.json` (scripts `typecheck`/`test`/`format`), `next.config.ts` (plugin
  next-intl), `.prettierrc.json`, `.github/workflows/ci.yml`, `public/`
  (plantillas CSV, sin SVGs de demo), `pnpm-workspace.yaml`, `.gitignore`, `README.md`.
- Estado de git: `master` hasta `5700a33` (40 commits), todo local sin push.
