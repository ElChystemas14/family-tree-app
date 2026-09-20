# Guía — Fase B: Calidad de producto

Objetivo: base mantenible (store + tests + CI) y pulido de producto.
Requiere Fase A cerrada. Criterio de salida: B1–B6 completos, CI en verde.
Roadmap: ítems B1–B6 (`../roadmap.md`).

## B1 — Extraer store

- [ ] Crear `useFamilyTree` (o zustand) con estado `{ persons, unions, relationships, posOverrides }`
      y acciones: `addPerson`, `connectUnion`, `removePerson` (con las reglas actuales),
      `moveNode`, `setLayout`, `importData`.
- [ ] Generar IDs (`crypto.randomUUID`) y leer estado **fuera** de updaters (regla: updaters puros).
- [ ] Desacoplar persistencia (Fase A2): el store emite, un suscriptor guarda/carga.
- [ ] `FlowInner` queda como composición: store + `ReactFlowProvider` + UI.
- Aceptación: `family-tree-canvas.tsx` < ~150 líneas legibles; sin `setState` dentro de updaters.

## B2 — Tests Vitest (AUD-HIGH-02)

- [ ] Instalar `vitest` (+ script `test`); fijar `TZ=America/Lima` en los tests de fechas.
- [ ] `transform`: generaciones, nodos/aristas esperados, anti-ciclos.
- [ ] Parentesco: `getParentIds`/`isAncestorOf`, защита contra uniones inválidas.
- [ ] Validaciones zod (casos válidos + inválidos) y serialización export/import.
- Aceptación: `pnpm test` verde; los tests cubren A1–A3.

## B3 — CI + formato (AUD-LOW-02, AUD-LOW-04)

- [ ] GitHub Actions: `pnpm install --frozen-lockfile`, `tsc --noEmit`, `eslint`, `test`, `build`.
- [ ] Prettier (config + `format` script) y formateo único de los archivos kilométricos v0
      (cambios solo de formato, commit separado).
- Aceptación: cada push/PR futuro corre el pipeline.

## B4 — Pulido (AUD-MED-02, AUD-MED-05, AUD-MED-06, AUD-LOW-01)

- [ ] Dark persistente (preferencia guardada, sin flash inicial).
- [ ] Quitar fuente Geist Sans sin uso (o darle uso).
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
