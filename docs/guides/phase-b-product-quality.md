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

## B2 — Tests Vitest (AUD-HIGH-02)

- [ ] `vitest` ya instalado en A1; aquí ampliar cobertura (no reinstalar).
      Fijar `TZ=America/Lima` en los tests de fechas.
- [ ] `transform`: generaciones, nodos/aristas esperados, anti-ciclos.
- [ ] Parentesco: `getParentIds`/`isAncestorOf` y `getFamilyRelationships(id, data)`
      con datos vivos (AUD-HIGH-05), protección contra uniones inválidas.
      (Nota: `store.test.ts` ya cubre parentesco y acciones con 8 tests; aquí ampliar
      con `transform` y serialización.)
- [ ] Validaciones zod (casos válidos + inválidos, incluye `birthDate` opcional y
      `photoUrl` de AUD-HIGH-06/MED-07) y serialización export/import.
- Aceptación: `pnpm test` verde; los tests cubren A1–A3.

## B3 — CI + formato (AUD-LOW-02, AUD-LOW-04)

- [ ] GitHub Actions: `pnpm install --frozen-lockfile`, `tsc --noEmit`, `eslint`, `test`, `build`.
      Recomendado adelantar `tsc + eslint + build` ya en Fase A si se quiere feedback
      temprano (el `test` se suma cuando exista A1).
- [ ] Prettier (config + `format` script) y formateo único de los archivos kilométricos v0
      (cambios solo de formato, commit separado).
- Aceptación: cada push/PR futuro corre el pipeline.

## B4 — Pulido (AUD-MED-02, AUD-MED-05, AUD-MED-06, AUD-LOW-01)

- [ ] Dark persistente (preferencia guardada, sin flash inicial).
- [ ] Quitar solo `Geist Sans` sin uso; conservar `Geist_Mono` (AUD-MED-02 corregida).
- [ ] Táctil: resolver drag-connect vs pan (modo conectar explícito o gesto alternativo).
- [ ] OG/Twitter cards mínimas + `robots`/`sitemap` básicos.
- Aceptación: checklist manual claro/oscuro × móvil/escritorio sin regresiones.

## B5 — Rendimiento de layout (AUD-MED-04)

- [ ] Memoizar dagre por (estructura + modo); derivar resaltado/búsqueda sin re-layout.
- Aceptación: seleccionar/buscar no re-ejecuta dagre (verificable con contador en dev).

## B6 — Vaciar dataset de prueba

- [ ] Sustituir Hawthorne por árbol vacío + onboarding ("crea tu primera persona").
- [ ] Conservar dataset como fixture de tests (`B2`), no como estado inicial.
- Aceptación: primer arranque limpio; tests usan el fixture.
