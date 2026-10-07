# Guía — Fase A: Integridad de datos

Objetivo: datos correctos, persistentes y validados + repo higiénico.
Criterio de salida: A1–A5 completos y `tsc` + `eslint` + `build` en verde.
Roadmap: ítems A1–A5 (`../roadmap.md`).

## A1 — Fix fechas UTC→local (AUD-CRIT-01) — hecho 2026-10-07

- [x] Instalar ya aquí `vitest` (+ script `test`) — A1 lo necesita; B2 lo amplía.
      Fijar `TZ=America/Lima` en los tests de fechas.
- [x] Crear helper `parseISODateLocal(iso: string): Date` en `src/lib/family-tree/dates.ts`:
      construir con `new Date(y, m - 1, d)` (nunca `new Date("YYYY-MM-DD")`).
- [x] Reescribir `formatDate`/`formatYear` sobre ese helper (zona `es-ES`).
      (`mock-data.ts` re-exporta desde `dates.ts`, sin duplicar lógica.)
- [x] Añadir tests que fijen `TZ` (p. ej. `America/Lima`) y cubran el borde 1 de enero
      (`formatYear("2000-01-01")` debe dar `2000`, hoy daría `1999` en UTC-5).
- [x] Verificar visualmente la ficha de Margaret (1954-08-17 → "17 ago 1954").
- Aceptación: tests en verde en al menos 2 zonas horarias distintas.
  Verificado en 3: `America/Lima`, `Pacific/Kiritimati`, `America/New_York` (6 tests).

## A2 — Persistencia local + export/import JSON (AUD-CRIT-02) — hecho 2026-10-07

- [x] Clave versionada, p. ej. `hawthorne-tree-v1`; guardar `{ version: 1, persons, unions, relationships, posOverrides? }`
      con debounce (~500 ms) ante cada `setData` (AUD-MED-08).
- [x] Al arrancar: estado inicial = dataset Hawthorne; en `useEffect` leer `localStorage`
      (evita mismatch de hidratación); si hay guardado válido, usarlo; si no, Hawthorne (hasta B6).
- [x] Validar lo leído con el esquema de A3 antes de hidratar (si falla: aviso + dataset de prueba, nunca crash).
      Envolver lectura/escritura en `try/catch` (`QuotaExceededError`, modo privado → aviso sin bloquear).
      Nota: validación estructural en `storage.ts`; la estricta con zod llega en A3 y la reutilizará.
- [x] Exportar: botón "Exportar JSON" (descarga `arbol-YYYY-MM-DD.json`, formato canónico = mismo shape + `version`).
- [x] Importar: selector de archivo + validación + resumen (N personas, M uniones, K errores) antes de aplicar.
- Aceptación: recargar conserva cambios; export→vaciar→import restaura idéntico.

## A3 — Esquema zod + validación en formularios (AUD-HIGH-03) — hecho 2026-10-07

- [x] Dependencia `zod`; esquemas en `src/lib/family-tree/schema.ts` para los 3 tipos
      (enums de `gender`, `unionType`, `relationship`; fechas `YYYY-MM-DD` opcionales).
- [x] Reglas de coherencia: muerte ≥ nacimiento; IDs únicos; `unionId`/`singleParentId`
      mutuamente excluyentes; referencias existentes (`validateFamilyTreeData`, que
      `storage.ts` reutiliza para carga/importación).
- [x] Alinear tipo `Person.birthDate` a opcional (`birthDate?: string`, AUD-HIGH-06);
      `photoUrl` solo `https://` o ruta `/`; eliminar `attributes.adopted` (la adopción
      vive en `relationship.type`, AUD-MED-07; la ficha lo deriva de los padres).
- [x] Hacer `getFamilyRelationships(personId, data)` pura (no leer el dataset
      importado) + tests con datos vivos (AUD-HIGH-05). `PersonDetailSheet` recibe `data`.
- [x] Aplicar en: modal crear/vincular, edición de ficha e importación (A2/C2).
- [x] Mensajes de error en español junto a cada campo (modal con `role="alert"`;
      edición con aviso y sin cerrar).
- Aceptación: imposible guardar persona sin nombre ni fechas incoherentes.

## A4 — Higiene de repo (AUD-HIGH-01, AUD-MED-01, AUD-MED-03, AUD-LOW-03)

- [ ] Borrar `package-lock.json` (único gestor: pnpm) y reinstalar limpio.
- [ ] Mover `shadcn` a `devDependencies`.
- [ ] Borrar SVGs sin uso de `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).
- [ ] Quitar `remotePatterns` de Unsplash de `next.config.ts` (o documentar por qué se queda).
- [ ] Verificar términos de atribución XYFlow con `hideAttribution: true`
      (confirmado presente en `family-tree-canvas.tsx`; quitarlo si no hay licencia Pro).
- Aceptación: `pnpm install --frozen-lockfile` limpio + `build` verde.

## A5 — README real (AUD-HIGH-04)

- [ ] Sustituir el de create-next-app por: qué es, setup con pnpm, scripts, estructura
      de `src/`, modelo de datos (resumen), enlaces a `docs/` y estado del roadmap.
- Aceptación: una persona nueva levanta el proyecto solo con el README.
