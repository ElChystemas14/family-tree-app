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
| 2026-10-07 | i18n con `next-intl`, sin routing (C4)              | `es` por defecto vía provider; `en` pendiente. UI externalizada; mensajes de `lib/` en español hasta post-v1.0.                              |
| 2026-10-07 | Fase C cerrada (C1–C4)                              | CSV v1.0 congelado + importador con reporte + export JSON/CSV + i18n.                                                                        |
| 2026-10-07 | Backend multiusuario: **Supabase** (D2)             | Auth (email + Google) + Postgres con RLS + Storage privado. Un proveedor, free tier suficiente; capa adapter para no casarse.                |
| 2026-10-07 | Colaboración: cuentas + roles e invitaciones (D)    | Roles owner/editor/viewer + enlaces revocables; varios árboles por usuario (`IDEA-08`, `IDEA-09` aceptadas).                                 |
| 2026-10-07 | Sync offline-first + `treeId`/`updatedAt` (D1)      | Lo local manda sin red; last-write-wins por fila; posiciones por usuario y árbol. Sin código aún.                                            |
| 2026-10-07 | Fase D cerrada (diseño)                             | Modelo, RLS, flujos y aceptación en `guides/phase-d-multiuser.md`.                                                                           |
| 2026-10-07 | Revisión final: v1.0 lista con reservas             | 55/55 tests en 2 TZ + checks verdes; `AUD-LOW-05` e `IDEA-17/18` a post-v1.0; CI y matriz manual al hacer push.                              |
| 2026-10-08 | Supabase: solo email + `.env` local (E1)            | Magic-link sin Google; `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` en `.env` gitignorado (tolera comillas); sin env la app sigue local.              |
| 2026-10-08 | Sesión vía `src/proxy.ts` (E1)                      | Convención Next 16 (no `middleware.ts`); refresco de cookies en cada request; tipos explícitos por genéricos `any` de supabase-js 2.117.     |
