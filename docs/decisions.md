# Registro de decisiones

Decisiones tomadas hasta 2026-09-20, con contexto. Añadir entrada por cada decisión
relevante futura (formato: fecha, decisión, contexto, consecuencias).

| Fecha      | Decisión                                            | Contexto / consecuencias                                                                                                                     |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09    | Gestor único: **pnpm**                              | `packageManager: pnpm@11`. Pendiente borrar `package-lock.json` (AUD-HIGH-01).                                                               |
| 2026-09    | **Local-first**, sin backend por ahora              | Uso personal/familiar; multiusuario es fase posterior. Consecuencia: persistencia en `localStorage` (Fase A).                                |
| 2026-09    | UI en **español**, i18n después                     | `lang="es"`, cadenas en ES; infra `next-intl` en Fase C.                                                                                     |
| 2026-09    | Tema **parchment/verde** propio                     | Tokens oklch del demo v0, Inter como fuente principal.                                                                                       |
| 2026-09    | Canvas como pantalla principal                      | Ruta única `/`; móvil con adaptaciones (botón Crear, MiniMap).                                                                               |
| 2026-09    | Fotos demo en local                                 | Cero peticiones a CDNs externos (privacidad + fiabilidad).                                                                                   |
| 2026-09    | Arrastre con persistencia + confirmación            | Las posiciones manuales se conservan; crear uniones pide confirmación.                                                                       |
| 2026-09    | Doble clic centra el linaje                         | Padres + parejas + hijos con `fitView` animado.                                                                                              |
| 2026-09    | IDs con `crypto.randomUUID()`                       | Prepara fusión multi-origen y multiusuario (sin colisiones).                                                                                 |
| 2026-09    | Borrado seguro                                      | Bloqueado si hay pareja/hijos; evita huérfanos silenciosos.                                                                                  |
| 2026-09    | Dataset Hawthorne como datos de prueba              | Se usa para validar nodos/movimientos; se vacía en Fase B (B6).                                                                              |
| 2026-09    | Modelo con `unionId`/`singleParentId`               | Soporta parejas, monoparentalidad y adopción; hermanos/hermanastros se derivan (IDEA-01).                                                    |
| 2026-09    | Todo local, sin push                                | Repo y commits en local hasta indicación contraria.                                                                                          |
| 2026-10-07 | Revisión auditoría 2026-10-07                       | Corregidos MED-02/LOW-03, añadidos HIGH-05/06 y MED-07/08; `vitest` se instala ya en A1; C4 no bloquea v1.0. Sin cambio de alcance de fases. |
| 2026-10-07 | `birthDate` opcional, `photoUrl` validada           | `Person.birthDate?`; solo `https://` o `/`; adopción vive en `relationship.type` (se retira `attributes.adopted`).                           |
| 2026-10-07 | Persistencia con `version` + lectura en `useEffect` | Evita mismatch de hidratación; `try/catch` de cupo/modo privado.                                                                             |
| 2026-10-07 | Arranque vacío + onboarding (B6)                    | `emptyTreeData` inicial; Hawthorne solo fixture de tests. Sin regresión: lo guardado en local se sigue cargando.                             |
| 2026-10-07 | Fase B cerrada (B1–B6)                              | Store + 41 tests + CI + Prettier + pulido + layout memoizado. CI correrá al hacer push.                                                      |
