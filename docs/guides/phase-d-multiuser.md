# Guía — Fase D: Puerta a multiusuario (diseño, sin código)

Estado: **diseño hecho 2026-10-07**. Esta fase no toca código: deja el modelo,
el stack y los criterios cerrados para implementar después. Roadmap: ítems
D1–D3 (`../roadmap.md`). Decisiones en [`../decisions.md`](../decisions.md).

Decisiones de partida (2026-10-07): stack **Supabase** (Auth + Postgres +
Storage), colaboración **cuentas con roles + invitaciones por enlace** y
**varios árboles por usuario** compartibles.

## D1 — Modelo extendido (propuesta, sin backend todavía)

Nada cambia en el código actual: los campos nuevos se añaden al implementar.
Los `id` siguen siendo texto con el generador actual (`crypto.randomUUID()` con
prefijo); no hay migración de formato.

Nuevas tablas:

- `trees`: `id` (texto), `name`, `ownerId` (uuid de Supabase Auth, creador),
  `createdAt`, `updatedAt`.
- `tree_memberships`: `treeId`, `userId`, `role` (`owner` | `editor` | `viewer`),
  `createdAt`. El creador es `owner` inicial.
- `tree_invites`: `id`, `treeId`, `role` (`editor` | `viewer`, nunca `owner`),
  `token` (aleatorio, revocable), `expiresAt`, `createdBy`, `revokedAt?`.
- `user_tree_settings` (opcional): `userId`, `treeId`, `posOverrides` (las
  posiciones manuales pasan a ser por usuario y árbol).

Entidades existentes (`persons`, `unions`, `relationships`): añaden `treeId`
(obligatorio) y `updatedAt` (para sync last-write-wins por fila).

Fotos: bucket privado `tree-photos/{treeId}/{photoId}`. Las filas guardan
`photoPath` (ruta del objeto); la app firma URLs al leer. `photoUrl` con
`https://` o ruta `/` sigue válido (legado + plantillas); las firmadas no se
persisten porque caducan.

Aislamiento (RLS, Postgres): `trees` visibles solo con membership; `persons` /
`unions` / `relationships` solo del `treeId` con membership; escritura solo
`owner`/`editor`; `tree_memberships` gestionable solo por `owner`;
`tree_invites` legibles por miembros, canje con verificación de `token`,
`expiresAt` y `revokedAt`. Matriz:

| Acción                                       | owner | editor | viewer |
| -------------------------------------------- | ----- | ------ | ------ |
| Leer datos                                   | sí    | sí     | sí     |
| Escribir datos (personas/uniones/relaciones) | sí    | sí     | no     |
| Invitar (editor/viewer)                      | sí    | sí     | no     |
| Gestionar miembros / borrar árbol            | sí    | no     | no     |

## D2 — Stack decidido: Supabase

- **Auth**: Supabase Auth con enlace mágico por email + OAuth Google (fricción
  mínima para la familia). Sesión en el layout; resto igual.
- **BD**: Postgres Supabase con RLS (políticas del apartado D1). Free tier de
  sobra (500 MB; genealogía ≈ KB). Ojo: el free tier pausa tras ~1 semana sin
  uso (se reactiva solo).
- **Fotos**: Supabase Storage privado + URLs firmadas al leer (nunca
  persistidas). Alternativas descartadas: piezas separadas (más cableado y la
  autorización queda manual en cada endpoint) y dejarlo abierto (bloquea
  estimar).
- **Acceso a datos**: capa repositorio/adapter sobre el store actual
  (`useFamilyTree` no cambia de API): hoy `localStorage`, mañana Supabase con
  la misma interfaz. Sin adapter no se implementa.
- **Sync offline-first** (coherente con el local-first actual): lo local sigue
  mandando sin conexión; al haber red, push/pull por árbol con last-write-wins
  por fila (`updatedAt`). La exportación JSON (A2/C3) sirve de semilla: al
  primer login se crea el árbol desde los datos locales.

## D3 — Criterios de aceptación (para la fase de implementación)

- [ ] Login email + Google; sin sesión no hay datos remotos.
- [ ] Aislamiento: un usuario no lee ni escribe árboles sin membership (tests
      contra RLS, no solo UI).
- [ ] Invitación: crear enlace con rol y caducidad, canjear con cuenta, revocar;
      árboles privados por defecto.
- [ ] Roles: `viewer` no escribe (UI + API), `editor` no gestiona miembros.
- [ ] Sync: editar offline y reconectar sube sin duplicar ni perder; conflicto =
      gana el `updatedAt` mayor.
- [ ] Fotos: sin URL firmada el objeto privado responde 403; la app no persiste
      firmadas.
- [ ] Migración: el JSON local actual crea el primer árbol idéntico al validar.
- [ ] Varios árboles por usuario con selector y ajustes por árbol.

Fuera de alcance aquí: comentarios (`IDEA-10`), PWA instalable (`IDEA-14`,
sinergia natural con el sync), GEDCOM (`IDEA-13`). Orden de implementación
sugerido: migraciones + RLS → Auth → adapter + sync → invitaciones → fotos →
roles en UI.

Ideas: `IDEA-08` (roles) e `IDEA-09` (invitaciones) aceptadas → esta fase.
