-- Fase E: multiusuario sobre Supabase (diseño en docs/guides/phase-d-multiuser.md).
-- Ejecutar UNA vez en Supabase Dashboard → SQL editor (idempotente).
-- Convenciones: ids de texto con el generador de la app; fechas ISO; `updatedAt`
-- lo escribe la app en cada cambio (last-write-wins por fila en el sync).

-- ============ Tablas ============

create table if not exists trees (
  id text primary key,
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists persons (
  id text primary key,
  tree_id text not null references trees (id) on delete cascade,
  first_name text not null check (char_length(first_name) > 0),
  last_name text not null check (char_length(last_name) > 0),
  gender text not null check (gender in ('male', 'female', 'other')),
  birth_date date,
  death_date date check (death_date is null or birth_date is null or death_date >= birth_date),
  photo_url text,
  photo_path text,
  bio text,
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists unions (
  id text primary key,
  tree_id text not null references trees (id) on delete cascade,
  partner1_id text not null references persons (id) on delete cascade,
  partner2_id text not null references persons (id) on delete cascade,
  union_type text not null default 'partnership'
    check (union_type in ('marriage', 'partnership', 'domestic')),
  start_date date,
  end_date date check (end_date is null or start_date is null or end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (partner1_id <> partner2_id)
);

create table if not exists relationships (
  id text primary key,
  tree_id text not null references trees (id) on delete cascade,
  child_id text not null references persons (id) on delete cascade,
  union_id text references unions (id) on delete cascade,
  single_parent_id text references persons (id) on delete cascade,
  type text not null default 'biological'
    check (type in ('biological', 'adopted', 'step')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (union_id is not null and single_parent_id is null) or
    (union_id is null and single_parent_id is not null)
  )
);

create table if not exists tree_memberships (
  tree_id text not null references trees (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create table if not exists tree_invites (
  id uuid primary key default gen_random_uuid(),
  tree_id text not null references trees (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_tree_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  tree_id text not null references trees (id) on delete cascade,
  pos_overrides jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, tree_id)
);

create index if not exists persons_tree_idx on persons (tree_id);
create index if not exists unions_tree_idx on unions (tree_id);
create index if not exists relationships_tree_idx on relationships (tree_id);
create index if not exists memberships_user_idx on tree_memberships (user_id);

-- ============ RLS ============

alter table trees enable row level security;
alter table persons enable row level security;
alter table unions enable row level security;
alter table relationships enable row level security;
alter table tree_memberships enable row level security;
alter table tree_invites enable row level security;
alter table user_tree_settings enable row level security;

-- Miembros ven su árbol y sus datos; escriben owner/editor.
drop policy if exists "trees_miembros_leen" on trees;
create policy "trees_miembros_leen" on trees for select
  using (exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = trees.id
      and tree_memberships.user_id = auth.uid()
  ));

drop policy if exists "trees_owner_crea" on trees;
create policy "trees_owner_crea" on trees for insert
  with check (owner_id = auth.uid());

drop policy if exists "trees_owner_gestiona" on trees;
create policy "trees_owner_gestiona" on trees for update using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = trees.id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role = 'owner'
  )
) with check (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = trees.id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role = 'owner'
  )
);

drop policy if exists "trees_owner_borra" on trees;
create policy "trees_owner_borra" on trees for delete using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = trees.id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role = 'owner'
  )
);

-- Datos: lectura para cualquier miembro, escritura solo owner/editor.
drop policy if exists "persons_miembros_leen" on persons;
create policy "persons_miembros_leen" on persons for select using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = persons.tree_id
      and tree_memberships.user_id = auth.uid()
  )
);

drop policy if exists "persons_editores_escriben" on persons;
create policy "persons_editores_escriben" on persons
  for insert with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = persons.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "persons_editores_actualizan" on persons;
create policy "persons_editores_actualizan" on persons
  for update using (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = persons.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  ) with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = persons.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "persons_editores_borran" on persons;
create policy "persons_editores_borran" on persons for delete using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = persons.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);

drop policy if exists "unions_miembros_leen" on unions;
create policy "unions_miembros_leen" on unions for select using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = unions.tree_id
      and tree_memberships.user_id = auth.uid()
  )
);

drop policy if exists "unions_editores_escriben" on unions;
create policy "unions_editores_escriben" on unions
  for insert with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = unions.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "unions_editores_actualizan" on unions;
create policy "unions_editores_actualizan" on unions
  for update using (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = unions.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  ) with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = unions.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "unions_editores_borran" on unions;
create policy "unions_editores_borran" on unions for delete using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = unions.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);

drop policy if exists "relationships_miembros_leen" on relationships;
create policy "relationships_miembros_leen" on relationships for select using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = relationships.tree_id
      and tree_memberships.user_id = auth.uid()
  )
);

drop policy if exists "relationships_editores_escriben" on relationships;
create policy "relationships_editores_escriben" on relationships
  for insert with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = relationships.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "relationships_editores_actualizan" on relationships;
create policy "relationships_editores_actualizan" on relationships
  for update using (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = relationships.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  ) with check (
    exists (
      select 1 from tree_memberships
      where tree_memberships.tree_id = relationships.tree_id
        and tree_memberships.user_id = auth.uid()
        and tree_memberships.role in ('owner', 'editor')
    )
  );

drop policy if exists "relationships_editores_borran" on relationships;
create policy "relationships_editores_borran" on relationships for delete using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = relationships.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);

-- Memberships: visibles para miembros; solo owner inserta/borra.
drop policy if exists "memberships_miembros_leen" on tree_memberships;
create policy "memberships_miembros_leen" on tree_memberships for select using (
  exists (
    select 1 from tree_memberships as m
    where m.tree_id = tree_memberships.tree_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "memberships_owner_gestiona" on tree_memberships;
create policy "memberships_owner_gestiona" on tree_memberships
  for all using (
    exists (
      select 1 from tree_memberships as m
      where m.tree_id = tree_memberships.tree_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  ) with check (
    exists (
      select 1 from tree_memberships as m
      where m.tree_id = tree_memberships.tree_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Invites: legibles por miembros del árbol; crear/revocar solo owner/editor.
drop policy if exists "invites_miembros_leen" on tree_invites;
create policy "invites_miembros_leen" on tree_invites for select using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = tree_invites.tree_id
      and tree_memberships.user_id = auth.uid()
  )
);

drop policy if exists "invites_editores_crean" on tree_invites;
create policy "invites_editores_crean" on tree_invites for insert with check (
  created_by = auth.uid() and exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = tree_invites.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);

drop policy if exists "invites_duenos_revocan" on tree_invites;
create policy "invites_duenos_revocan" on tree_invites for update using (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = tree_invites.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role = 'owner'
  )
) with check (
  exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = tree_invites.tree_id
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role = 'owner'
  )
);

-- Ajustes: cada usuario solo los suyos.
drop policy if exists "settings_propias" on user_tree_settings;
create policy "settings_propias" on user_tree_settings for all using (
  user_id = auth.uid()
) with check (user_id = auth.uid());

-- Canje de invitación: valida token/caducidad/revocación y crea membership.
create or replace function redeem_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite tree_invites%rowtype;
begin
  select * into v_invite from tree_invites where token = p_token;
  if not found then
    raise exception 'Invitación no válida.';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Invitación revocada.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invitación caducada.';
  end if;
  insert into tree_memberships (tree_id, user_id, role)
  values (v_invite.tree_id, auth.uid(), v_invite.role)
  on conflict (tree_id, user_id) do nothing;
  return v_invite.tree_id;
end;
$$;

-- ============ Storage privado ============

insert into storage.buckets (id, name, public)
values ('tree-photos', 'tree-photos', false)
on conflict (id) do nothing;

drop policy if exists "fotos_miembros_leen" on storage.objects;
create policy "fotos_miembros_leen" on storage.objects for select using (
  bucket_id = 'tree-photos' and exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = (storage.foldername(name))[1]
      and tree_memberships.user_id = auth.uid()
  )
);

drop policy if exists "fotos_editores_suben" on storage.objects;
create policy "fotos_editores_suben" on storage.objects for insert with check (
  bucket_id = 'tree-photos' and exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = (storage.foldername(name))[1]
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);

drop policy if exists "fotos_editores_borran" on storage.objects;
create policy "fotos_editores_borran" on storage.objects for delete using (
  bucket_id = 'tree-photos' and exists (
    select 1 from tree_memberships
    where tree_memberships.tree_id = (storage.foldername(name))[1]
      and tree_memberships.user_id = auth.uid()
      and tree_memberships.role in ('owner', 'editor')
  )
);
