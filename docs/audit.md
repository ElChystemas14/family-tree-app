# Auditoría inicial — family-tree-app

- **Fecha**: 2026-09-20
- **Alcance**: código en `master` hasta `38967f8`, configuración, documentación y repo.
- **Método**: lectura de fuentes, ejecución (`tsc`, `eslint`, `build`), pruebas de comportamiento (p. ej. parseo de fechas con TZ) e inspección de dependencias instaladas.
- **Veredicto**: prototipo avanzado (6.4/10), no producto. Ver `roadmap.md` para el plan de cierre de brechas.

## Notas por área

| Área | Nota | Resumen |
|---|---|---|
| Arquitectura | 6/10 | Estructura Next.js correcta, pero sin capa de datos ni persistencia |
| Diseño UI/UX | 7/10 | Tema coherente y flujo usable; mezcla de estilos shadcn y detalles pendientes |
| Calidad de código | 6/10 | Tipos y lint en verde, cero tests, archivos monolíticos estilo v0 |
| Configuración/DevOps | 5/10 | Build verde; lockfiles duplicados, README genérico, sin CI |
| Seguridad/Privacidad | 6/10 | Correcto para fase local; sin auth ni persistencia aún |
| Rendimiento | 7/10 | Sin problemas a escala familiar; recomputos evitables y una fuente de más |

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

### Medios

#### AUD-MED-01 — CLI `shadcn` en `dependencies`
- **Ubicación**: `package.json:22`. Lastra la instalación de producción.
- **Fix**: mover a `devDependencies`. **Roadmap**: Fase A.

#### AUD-MED-02 — Fuente Geist Sans descargada sin uso
- **Ubicación**: `src/app/layout.tsx` la carga, pero el tema resuelve `--font-sans` a Inter.
- **Fix**: quitarla o darle uso real. **Roadmap**: Fase B.

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

### Bajos

#### AUD-LOW-01 — Sin Open Graph, sitemap ni robots
- Bajo valor en una SPA de una ruta; gratis con Metadata API. **Roadmap**: Fase B.

#### AUD-LOW-02 — Sin CI
- **Fix**: GitHub Actions con `tsc` + `eslint` + `build` (+ tests en Fase B).
- **Roadmap**: Fase B.

#### AUD-LOW-03 — Verificar atribución XYFlow
- Se usa `proOptions={{ hideAttribution: true }}`; revisar términos para el caso de uso.
- **Roadmap**: Fase A (una línea de verificación, coste ~0).

#### AUD-LOW-04 — Archivos de una sola línea kilométrica (herencia v0)
- Dificultan revisión y debug. **Fix**: Prettier + formateo. **Roadmap**: Fase B.

## Mapa de archivos revisados

- `src/components/family-tree/*` (6 archivos), `src/lib/family-tree/*`,
  `src/types/family-tree.ts`, `src/app/*`, `src/components/ui/*` (17 primitivas).
- `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
  `postcss.config.mjs`, `components.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`.
- Estado de git: `master` limpio, 16 commits, todo local sin push.
