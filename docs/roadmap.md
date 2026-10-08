# Roadmap — family-tree-app

Objetivo: pasar de prototipo a **v1.0 usable por la familia** (local-first, en español,
canvas como pantalla principal) dejando el cimiento para intercambio de datos (CSV/export)
y multiusuario posterior. Todo el trabajo es local; sin push hasta indicación contraria.

- Auditoría origen: [`audit.md`](audit.md) (los ítems citan IDs `AUD-*`; revisada 2026-10-07).
- Ideas aparcadas (no comprometidas): [`ideas.md`](ideas.md) (IDs `IDEA-*`).
- Decisiones tomadas: [`decisions.md`](decisions.md).
- Guías de ejecución: [`guides/`](guides/) (una por fase + especificación CSV).

## Leyenda de estado

- `pendiente` · `en curso` · `hecho` · `aparcado`
- Cada fase tiene **criterio de salida**: no se da por cerrada hasta cumplirlo.

## Estado general

| Fase                      | Estado                             | Guía                                                       | Criterio de salida                                                       |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| A — Integridad de datos   | hecho (A1–A5, 2026-10-07)          | `guides/phase-a-data-integrity.md`                         | Fechas correctas + persistencia local + validación base + repo higiénico |
| B — Calidad de producto   | hecho (B1–B6, 2026-10-07)          | `guides/phase-b-product-quality.md`                        | Store extraído + tests + CI + dataset de prueba limpio                   |
| C — Intercambio de datos  | en curso (C1–C2 hechos 2026-10-07) | `guides/phase-c-data-exchange.md` + `guides/csv-format.md` | Import CSV documentado funcionando + export JSON/CSV                     |
| D — Puerta a multiusuario | pendiente (diseño)                 | (se creará `guides/phase-d-multiuser.md`)                  | Modelo con `ownerId`/`treeId`, decisions actualizadas                    |

## Fase A — Integridad de datos

- [x] **A1** Fix fechas UTC→local + instalar `vitest` + tests con TZ fija → `AUD-CRIT-01` (hecho 2026-10-07)
- [x] **A2** Persistencia `localStorage` versionada (`{ version, … }`, lectura en `useEffect`,
      `try/catch` de cupo) + export/import JSON → `AUD-CRIT-02`, `AUD-MED-08` (hecho 2026-10-07)
- [x] **A3** Esquema zod Persona/Unión/Relación + validación en formularios +
      `birthDate?` opcional + `photoUrl` validada + `getFamilyRelationships(id, data)` pura →
      `AUD-HIGH-03`, `AUD-HIGH-05`, `AUD-HIGH-06`, `AUD-MED-07` (hecho 2026-10-07)
- [x] **A4** Higiene de repo: borrado `package-lock.json`, `shadcn` a devDeps, SVGs
      e `remotePatterns` eliminados, atribución XYFlow visible →
      `AUD-HIGH-01`, `AUD-MED-01`, `AUD-MED-03`, `AUD-LOW-03` (hecho 2026-10-07)
- [x] **A5** README real (setup, scripts, modelo de datos, enlaces a docs) → `AUD-HIGH-04` (hecho 2026-10-07)
- Detalle paso a paso: `guides/phase-a-data-integrity.md`.

## Fase B — Calidad de producto

- [x] **B1** Extraer store (`useFamilyTree`/zustand): acciones, IDs fuera de updaters,
      persistencia desacoplada (prepara multiusuario) (hecho 2026-10-07; conteo de
      líneas pendiente de formateo B3)
- [x] **B2** Ampliar tests Vitest (ya instalado en A1): `transform`, parentesco/antepasados
      con datos vivos, validaciones, serialización → `AUD-HIGH-02`, `AUD-HIGH-05`
      (hecho 2026-10-07, 34/34 en 2 TZ)
- [x] **B3** CI (tsc + eslint + build + tests) + Prettier y formateo de archivos v0 →
      `AUD-LOW-02`, `AUD-LOW-04` (hecho 2026-10-07)
- [x] **B4** Pulido: dark persistente, quitar solo `Geist Sans`, táctil, OG mínimo →
      `AUD-MED-02`, `AUD-MED-05`, `AUD-MED-06`, `AUD-LOW-01` (hecho 2026-10-07;
      checklist manual pendiente)
- [x] **B5** Memoizar layout por estructura+modo (resaltado aparte) → `AUD-MED-04`
      (hecho 2026-10-07)
- [x] **B6** Vaciar dataset Hawthorne → árbol vacío + onboarding "crea tu primera persona"
      (hecho 2026-10-07)
- Detalle paso a paso: `guides/phase-b-product-quality.md`.

## Fase C — Intercambio de datos

- [x] **C1** Congelar especificación CSV (`guides/csv-format.md` v1.0): personas, uniones,
      relaciones + plantilla descargable (hecho 2026-10-07)
- [x] **C2** Importador con reporte de errores por fila (usa validación de Fase A) → `AUD-HIGH-03`
      (hecho 2026-10-07)
- [ ] **C3** Exportación JSON (formato canónico) + CSV espejo del formato de importación
- [ ] **C4** Infra i18n (`next-intl`) con `es` por defecto, `en` pendiente (opcional, no bloquea v1.0)
- Detalle paso a paso: `guides/phase-c-data-exchange.md`.

## Fase D — Puerta a multiusuario (diseño, sin código aún)

- [ ] **D1** Añadir `ownerId`/`treeId` al modelo (sin backend todavía)
- [ ] **D2** Decidir stack (Auth + BD + storage de fotos) y registrarlo en `decisions.md`
- [ ] **D3** Crear `guides/phase-d-multiuser.md` con criterios de aceptación
- Ideas relacionadas: `IDEA-03` (roles), `IDEA-04` (invitaciones), `IDEA-09` (PWA/offline).

## Trazabilidad auditoría → roadmap

| Hallazgo                                       | Fase/Ítem      |
| ---------------------------------------------- | -------------- |
| AUD-CRIT-01, AUD-CRIT-02                       | A1, A2         |
| AUD-HIGH-01, AUD-HIGH-03, AUD-HIGH-04          | A4, A3/C2, A5  |
| AUD-HIGH-02                                    | B2             |
| AUD-HIGH-05, AUD-HIGH-06                       | A3 (+ B1/B2)   |
| AUD-MED-01, AUD-MED-03                         | A4             |
| AUD-MED-02, AUD-MED-04, AUD-MED-05, AUD-MED-06 | B4, B5, B4, B4 |
| AUD-MED-07, AUD-MED-08                         | A3, A2         |
| AUD-LOW-01, AUD-LOW-02, AUD-LOW-03, AUD-LOW-04 | B4, B3, A4, B3 |

## Cómo se avanza

1. Elegir el siguiente ítem pendiente de la fase activa (A → B → C).
2. Seguir su guía correspondiente; marcar checkboxes en guía y roadmap al completar.
3. Commits convencionales en local; al cerrar fase, actualizar la tabla de estado y el
   criterio de salida.
