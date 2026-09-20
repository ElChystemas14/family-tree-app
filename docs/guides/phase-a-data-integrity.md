# Guía — Fase A: Integridad de datos

Objetivo: datos correctos, persistentes y validados + repo higiénico.
Criterio de salida: A1–A5 completos y `tsc` + `eslint` + `build` en verde.
Roadmap: ítems A1–A5 (`../roadmap.md`).

## A1 — Fix fechas UTC→local (AUD-CRIT-01)

- [ ] Crear helper `parseISODateLocal(iso: string): Date` en `src/lib/family-tree/dates.ts`:
      construir con `new Date(y, m - 1, d)` (nunca `new Date("YYYY-MM-DD")`).
- [ ] Reescribir `formatDate`/`formatYear` sobre ese helper (zona `es-ES`).
- [ ] Añadir tests que fijen `TZ` (p. ej. `America/Lima`) y cubran el borde 1 de enero
      (`formatYear("2000-01-01")` debe dar `2000`, hoy daría `1999` en UTC-5).
- [ ] Verificar visualmente la ficha de Margaret (1954-08-17 → "17 ago 1954").
- Aceptación: tests en verde en al menos 2 zonas horarias distintas.

## A2 — Persistencia local + export/import JSON (AUD-CRIT-02)

- [ ] Clave versionada, p. ej. `hawthorne-tree-v1`; guardar `{ persons, unions, relationships, posOverrides? }`
      con debounce (~500 ms) ante cada `setData`.
- [ ] Al arrancar: si hay guardado válido, usarlo; si no, dataset Hawthorne (hasta B6).
- [ ] Validar lo leído con el esquema de A3 antes de hidratar (si falla: aviso + dataset de prueba, nunca crash).
- [ ] Exportar: botón "Exportar JSON" (descarga `arbol-YYYY-MM-DD.json`, formato canónico = mismo shape).
- [ ] Importar: selector de archivo + validación + resumen (N personas, M uniones, K errores) antes de aplicar.
- Aceptación: recargar conserva cambios; export→vaciar→import restaura idéntico.

## A3 — Esquema zod + validación en formularios (AUD-HIGH-03)

- [ ] Dependencia `zod`; esquemas en `src/lib/family-tree/schema.ts` para los 3 tipos
      (enums de `gender`, `unionType`, `relationship`; fechas `YYYY-MM-DD` opcionales).
- [ ] Reglas de coherencia: muerte ≥ nacimiento; IDs únicos; `unionId`/`singleParentId`
      mutuamente excluyentes; referencias existentes.
- [ ] Aplicar en: modal crear/vincular, edición de ficha e importación (A2/C2).
- [ ] Mensajes de error en español junto a cada campo.
- Aceptación: imposible guardar persona sin nombre ni fechas incoherentes.

## A4 — Higiene de repo (AUD-HIGH-01, AUD-MED-01, AUD-MED-03, AUD-LOW-03)

- [ ] Borrar `package-lock.json` (único gestor: pnpm) y reinstalar limpio.
- [ ] Mover `shadcn` a `devDependencies`.
- [ ] Borrar SVGs sin uso de `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).
- [ ] Quitar `remotePatterns` de Unsplash de `next.config.ts` (o documentar por qué se queda).
- [ ] Verificar términos de atribución XYFlow con `hideAttribution: true`.
- Aceptación: `pnpm install --frozen-lockfile` limpio + `build` verde.

## A5 — README real (AUD-HIGH-04)

- [ ] Sustituir el de create-next-app por: qué es, setup con pnpm, scripts, estructura
      de `src/`, modelo de datos (resumen), enlaces a `docs/` y estado del roadmap.
- Aceptación: una persona nueva levanta el proyecto solo con el README.
