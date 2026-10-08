# Guía — Fase C: Intercambio de datos

Objetivo: entrar y salir datos con formato documentado.
Requiere Fases A (validación) y B (tests) cerradas.
Criterio de salida: C1–C4 completos con la spec congelada.
Roadmap: ítems C1–C4 (`../roadmap.md`). Spec: [`csv-format.md`](csv-format.md).

## C1 — Congelar especificación CSV v1.0 — hecho 2026-10-07

- [x] Revisar `csv-format.md` (borrador) con datos reales de prueba; congelar como v1.0
      (cambios posteriores = v1.1 con notas de migración).
      Decisiones: columna `attributes` (JSON, round-trip idéntico), autodetección
      `;` (Excel ES) y modo parcial (las válidas se aplican, las inválidas se listan).
- [x] Publicar plantilla descargable (`plantilla-personas.csv`, etc.) generada desde la spec.
      Builders en `src/lib/family-tree/csv.ts` (`parseCsvText`/`serializeCsv` RFC 4180);
      test que exige `public/` byte-idéntico a los builders.
- Aceptación: la plantilla importa sin errores en árbol vacío.
  Verificado por test (3 personas + unión + relación válidas; Hawthorne→CSV→import idéntico).

## C2 — Importador con reporte por fila (AUD-HIGH-03)

- [ ] Subida de 1–3 CSV (personas, uniones, relaciones) con vista previa antes de aplicar.
- [ ] Validación con zod (A3): por cada fila errónea, nº de línea + campo + motivo; las
      válidas se aplican, las inválidas se listan sin bloquear el resto (modo parcial decidido en C1).
- [ ] Detección de IDs duplicados intra-archivo y contra el árbol actual.
- Aceptación: importar el dataset Hawthorne en CSV reproduce el árbol de prueba.

## C3 — Exportación

- [ ] JSON canónico (= shape del store, con `version` de formato).
- [ ] CSV espejo del formato de importación (round-trip: export→import idéntico).
- [ ] Aviso de privacidad si hay personas vivas incluidas.
- Aceptación: round-trip JSON y CSV verificados por test.

## C4 — Infra i18n (opcional, no bloquea v1.0)

- [ ] Instalar `next-intl`, mover cadenas ES a catálogo `es`, locale por defecto `es`.
- [ ] `en` como locale pendiente (no bloquea v1.0). Si urge v1.0, puede moverse a post-v1.0
      sin afectar C1–C3.
- Aceptación: la app funciona igual con cadenas externalizadas; añadir un idioma = añadir un archivo.
