# Guía — Fase B: Calidad de producto

Objetivo: base mantenible (store + tests + CI) y pulido de producto.
Requiere Fase A cerrada. Criterio de salida: B1–B6 completos, CI en verde.
Roadmap: ítems B1–B6 (`../roadmap.md`).

## B1 — Extraer store — hecho 2026-10-07

- [x] Crear `useFamilyTree` (o zustand) con estado `{ persons, unions, relationships, posOverrides }`
      y acciones: `addPerson`, `connectUnion`, `removePerson` (con las reglas actuales),
      `moveNode`, `setLayout`, `importData`.
      Implementado como hook en `src/lib/family-tree/store.ts` (sin nueva dependencia);
      además `updatePerson` (edición) y `getParentIds`/`isAncestorOf` movidos al store.
- [x] Generar IDs (`crypto.randomUUID`) y leer estado **fuera** de updaters (regla: updaters puros).
      Las acciones son funciones puras `apply*` testeadas (`store.test.ts`, 8 tests).
- [x] Desacoplar persistencia (Fase A2): el store emite, un suscriptor guarda/carga.
      Los efectos de carga/guardado siguen en el canvas, ahora vía `importData`.
- [x] `FlowInner` queda como composición: store + `ReactFlowProvider` + UI.
- Aceptación: `family-tree-canvas.tsx` < ~150 líneas legibles; sin `setState` dentro de updaters.
  Parcial: lógica extraída y sin `setState` en updaters (efectos de hidratación con
  `eslint-disable` justificado); el conteo de líneas queda pendiente del formateo B3
  (el fichero sigue con líneas kilométricas v0: 130 líneas / 18 kB).

## B2 — Tests Vitest (AUD-HIGH-02) — hecho 2026-10-07

- [x] `vitest` ya instalado en A1; aquí ampliar cobertura (no reinstalar).
      Fijar `TZ=America/Lima` en los tests de fechas.
- [x] `transform`: generaciones, nodos/aristas esperados, anti-ciclos.
      (`transform.test.ts`, 6 tests: 21 nodos/20 aristas, generaciones 0–2,
      resaltado/dimmed, monoparental, ciclo sin cuelgue, vertical vs horizontal.)
- [x] Parentesco: `getParentIds`/`isAncestorOf` y `getFamilyRelationships(id, data)`
      con datos vivos (AUD-HIGH-05), protección contra uniones inválidas.
      (Cubierto en `store.test.ts` + `relationships.test.ts` desde B1/A3.)
- [x] Validaciones zod (casos válidos + inválidos, incluye `birthDate` opcional y
      `photoUrl` de AUD-HIGH-06/MED-07) y serialización export/import.
      (Cubierto en `schema.test.ts`; round-trip JSON idéntico en `storage.test.ts`.)
- Aceptación: `pnpm test` verde; los tests cubren A1–A3.
  34/34 en `America/Lima` y `Pacific/Kiritimati`.

## B3 — CI + formato (AUD-LOW-02, AUD-LOW-04) — hecho 2026-10-07

- [x] GitHub Actions (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`,
      `format:check`, `typecheck` (`tsc --noEmit`), `lint`, `test` (con `TZ: America/Lima`), `build`.
- [x] Prettier (`.prettierrc.json` + scripts `format` / `format:check`, `.prettierignore`)
      y formateo único de los archivos kilométricos v0 (cambios solo de formato, commit separado).
- Aceptación: cada push/PR futuro corre el pipeline.

## B4 — Pulido (AUD-MED-02, AUD-MED-05, AUD-MED-06, AUD-LOW-01) — hecho 2026-10-07

- [x] Dark persistente (preferencia guardada, sin flash inicial).
      Clave `hawthorne-theme` (`theme.ts` + tests); script bloqueante en el layout
      aplica la clase antes del primer pintado; oscuro por defecto (sin regresión).
- [x] Quitar solo `Geist Sans` sin uso; conservar `Geist_Mono` (AUD-MED-02 corregida).
- [x] Táctil: resolver drag-connect vs pan (modo conectar explícito o gesto alternativo).
      En táctil (`pointerType: touch` o puntero grueso) arrastrar solo mueve;
      la pareja se crea desde ⋯ → "Añadir pareja" (documentado en la ayuda).
- [x] OG/Twitter cards mínimas + `robots`/`sitemap` básicos.
      (`openGraph`/`twitter` en `layout.tsx`; `src/app/robots.ts` + `sitemap.ts`;
      dominio vía `NEXT_PUBLIC_SITE_URL`, `localhost` por defecto.)
- Aceptación: checklist manual claro/oscuro × móvil/escritorio sin regresiones.
  Pendiente de verificación manual: alternar tema y recargar (persiste);
  arrastrar en táctil no propone unión; `/robots.txt` y `/sitemap.xml` en verde.

## B5 — Rendimiento de layout (AUD-MED-04) — hecho 2026-10-07

- [x] Memoizar dagre por (estructura + modo); derivar resaltado/búsqueda sin re-layout.
      `transform.ts` dividido en `layoutFamilyToGraph` (dagre + generaciones) y
      `withGraphSelection` (resaltado/búsqueda/callbacks); el canvas memoiza el
      layout con deps `[data, layout]` y deriva selección/búsqueda aparte.
      `transformFamilyToGraph` se conserva como envoltorio (tests intactos).
- Aceptación: seleccionar/buscar no re-ejecuta dagre (verificable con contador en dev).
  En dev cada layout registra `[layout] dagre ejecutado (N)` en consola;
  tests que comparan posiciones entre selecciones/búsquedas (`transform.test.ts`).

## B6 — Vaciar dataset de prueba

- [ ] Sustituir Hawthorne por árbol vacío + onboarding ("crea tu primera persona").
- [ ] Conservar dataset como fixture de tests (`B2`), no como estado inicial.
- Aceptación: primer arranque limpio; tests usan el fixture.
