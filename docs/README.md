# Documentación — family-tree-app

Mapa de la documentación del proyecto. El código vive en `src/`; aquí vive el **porqué,
el qué sigue y cómo avanzarlo**.

## Mapa

| Documento                                                                | Qué contiene                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [`audit.md`](audit.md)                                                   | Auditoría inicial (2026-09-20): notas por área y hallazgos `AUD-*` con evidencia |
| [`roadmap.md`](roadmap.md)                                               | Plan por fases con checkboxes, criterios de salida y trazabilidad a hallazgos    |
| [`ideas.md`](ideas.md)                                                   | Backlog de ideas futuras `IDEA-*` (aparcadas, no comprometidas)                  |
| [`decisions.md`](decisions.md)                                           | Registro de decisiones tomadas y su contexto                                     |
| [`guides/phase-a-data-integrity.md`](guides/phase-a-data-integrity.md)   | Guía de ejecución: Fase A (integridad)                                           |
| [`guides/phase-b-product-quality.md`](guides/phase-b-product-quality.md) | Guía de ejecución: Fase B (calidad)                                              |
| [`guides/phase-c-data-exchange.md`](guides/phase-c-data-exchange.md)     | Guía de ejecución: Fase C (intercambio)                                          |
| [`guides/csv-format.md`](guides/csv-format.md)                           | Especificación v1.0 (congelada) del formato CSV de importación                   |
| [`guides/phase-d-multiuser.md`](guides/phase-d-multiuser.md)             | Diseño multiusuario: modelo, Supabase, flujos y aceptación (sin código)          |

## Cómo se relacionan

```
audit.md (hallazgos AUD-*) ──→ roadmap.md (fases e ítems) ──→ guides/* (paso a paso)
                                       │
                                       ├──→ ideas.md (futuro, IDEA-*)
                                       └──→ decisions.md (lo ya decidido)
```

## Seguimiento del avance

1. `roadmap.md` es el tablero: fase activa y siguiente ítem pendiente.
2. Cada ítem apunta a su hallazgo (`audit.md`) y a su guía (`guides/`).
3. Al completar: marcar el checkbox en la guía y en el roadmap, commitear en local.
4. Las ideas nuevas van a `ideas.md` con estado `propuesta`; solo entran al roadmap
   por decisión explícita.
