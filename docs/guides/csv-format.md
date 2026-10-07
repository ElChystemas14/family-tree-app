# Especificación CSV v1.0 (borrador) — importación

Estado: **borrador** (se congela en Fase C, ítem C1). Codificación UTF-8
(recomendado con BOM para Excel ES), separador `,` con quoting RFC 4180
(nota: en Excel español puede requerir `;` — documentar conversión), cabecera
obligatoria, fechas `YYYY-MM-DD`. Los `id` son estables y los generan quien
importa (`crypto.randomUUID()` recomendado); vacíos = se generan al importar.

## `personas.csv`

| Columna     | Requerida    | Valores                                                                       |
| ----------- | ------------ | ----------------------------------------------------------------------------- |
| `id`        | no           | texto único                                                                   |
| `firstName` | **sí**       | texto no vacío                                                                |
| `lastName`  | **sí**       | texto no vacío                                                                |
| `gender`    | no (`other`) | `male` \| `female` \| `other`                                                 |
| `birthDate` | no           | `YYYY-MM-DD` (alineado con `Person.birthDate?` opcional, AUD-HIGH-06)         |
| `deathDate` | no           | `YYYY-MM-DD` (≥ `birthDate`)                                                  |
| `photoUrl`  | no           | `https://…` o ruta `/…` (se rechaza `javascript:`, `data:`, etc., AUD-MED-07) |
| `bio`       | no           | texto libre (máx. recomendado 2000 car.)                                      |

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

## Historial de versiones

- v1.0-borrador (2026-09-20): propuesta inicial. Congelar en C1.
