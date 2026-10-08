# Especificación CSV v1.0 (congelada) — importación

Estado: **v1.0 congelada** (2026-10-07, ítem C1). Cambios posteriores = v1.1 con
notas de migración. Codificación UTF-8 (recomendado con BOM para Excel ES),
separador `,` con quoting RFC 4180; el importador autodetecta `;` (Excel
español) por la cabecera. Cabecera obligatoria (el orden de columnas no
importa; columnas desconocidas se ignoran), fechas `YYYY-MM-DD`. Los `id` son
estables y los genera quien importa (`crypto.randomUUID()` recomendado);
vacíos = se generan al importar.

## `personas.csv`

| Columna      | Requerida    | Valores                                                                       |
| ------------ | ------------ | ----------------------------------------------------------------------------- |
| `id`         | no           | texto único                                                                   |
| `firstName`  | **sí**       | texto no vacío                                                                |
| `lastName`   | **sí**       | texto no vacío                                                                |
| `gender`     | no (`other`) | `male` \| `female` \| `other`                                                 |
| `birthDate`  | no           | `YYYY-MM-DD` (alineado con `Person.birthDate?` opcional, AUD-HIGH-06)         |
| `deathDate`  | no           | `YYYY-MM-DD` (≥ `birthDate`)                                                  |
| `photoUrl`   | no           | `https://…` o ruta `/…` (se rechaza `javascript:`, `data:`, etc., AUD-MED-07) |
| `bio`        | no           | texto libre (máx. recomendado 2000 car.)                                      |
| `attributes` | no           | objeto JSON como texto (p. ej. `{"occupation":"Botanista"}`); preserva campos |

## `uniones.csv`

| Columna                 | Requerida          | Valores                                                   |
| ----------------------- | ------------------ | --------------------------------------------------------- |
| `id`                    | no                 | texto único                                               |
| `partner1Id`            | **sí**             | `id` existente en personas                                |
| `partner2Id`            | **sí**             | `id` existente, distinto de `partner1Id`                  |
| `unionType`             | no (`partnership`) | `marriage` \| `partnership` \| `domestic`                 |
| `startDate` / `endDate` | no                 | `YYYY-MM-DD` (`endDate` ≥ `startDate` si ambos presentes) |

## `relaciones.csv`

| Columna          | Requerida         | Valores                                                       |
| ---------------- | ----------------- | ------------------------------------------------------------- |
| `id`             | no                | texto único                                                   |
| `childId`        | **sí**            | `id` existente en personas                                    |
| `unionId`        | condicional       | `id` existente en uniones **o** vacío si hay `singleParentId` |
| `singleParentId` | condicional       | `id` existente si no hay `unionId` (excluyentes)              |
| `type`           | no (`biological`) | `biological` \| `adopted` \| `step`                           |

## Reglas y errores

- Referencias inexistentes, IDs duplicados, fechas inválidas o `unionId`+`singleParentId`
  simultáneos → fila rechazada con `línea + campo + motivo` (ver C2 en
  `phase-c-data-exchange.md`).
- Modo parcial (decisión C1): las filas válidas se aplican y las inválidas se
  listan sin bloquear el resto. Modo estricto (todo o nada) queda post-v1.0.
- Orden de carga: personas → uniones → relaciones.
- Ejemplo mínimo (padre + madre + hija):

```csv
id,firstName,lastName,gender,birthDate
p1,Ana,Ruiz,female,1970-05-02
p2,Luis,Ruiz,male,1968-11-19
p3,Sofía,Ruiz,female,1998-02-10
```

```csv
id,partner1Id,partner2Id,unionType
u1,p1,p2,marriage
```

```csv
id,childId,unionId,singleParentId,type
r1,p3,u1,,biological
```

## Plantillas

`public/plantilla-personas.csv`, `plantilla-uniones.csv` y
`plantilla-relaciones.csv` (generadas desde `src/lib/family-tree/csv.ts`;
un test verifica que son byte-idénticas a los builders e importan sin
errores en árbol vacío).

## Historial de versiones

- v1.0 (2026-10-07): congelada en C1. Añade `attributes` (round-trip idéntico),
  autodetección `;` y modo parcial.
- v1.0-borrador (2026-09-20): propuesta inicial.
