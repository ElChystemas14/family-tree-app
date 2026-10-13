-- 0002: corrige "infinite recursion detected in policy for tree_memberships".
-- Causa: las políticas de 0001 consultaban tree_memberships dentro de sus
-- propias políticas (autorreferencia). Fix: función SECURITY DEFINER
-- `tree_role()` (salta RLS al ser owner postgres) y reescritura de todas las
-- políticas que tocaban memberships para usarla. Además `create_tree()` RPC
-- que crea árbol + membership owner de forma atómica (la app ya no inserta
-- memberships directamente: evita el huevo-gallina del owner inicial).
-- Ejecutar en Supabase Dashboard → SQL editor (idempotente).

-- Rol del usuario actual en un árbol (null si no es miembro). Sin RLS aquí
-- dentro: al ser SECURITY DEFINER no hay recursión en las políticas que la usan.
create or replace function tree_role(p_tree_id text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from tree_memberships
  where tree_id = p_tree_id and user_id = auth.uid()
$$;

-- Creación atómica árbol + owner (la app llama a esta RPC).
create or replace function create_tree(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id text := 'tree-' || gen_random_uuid()::text;
  v_name text := coalesce(nullif(trim(coalesce(p_name, '')), ''), 'Mi árbol');
begin
  if v_user is null then
    raise exception 'Login requerido.';
  end if;
  insert into trees (id, name, owner_id) values (v_id, v_name, v_user);
  insert into tree_memberships (tree_id, user_id, role)
  values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

-- ============ trees ============

drop policy if exists "trees_miembros_leen" on trees;
create policy "trees_miembros_leen" on trees for select
  using (tree_role(trees.id) is not null);

drop policy if exists "trees_owner_crea" on trees;
create policy "trees_owner_crea" on trees for insert
  with check (owner_id = auth.uid());

drop policy if exists "trees_owner_gestiona" on trees;
create policy "trees_owner_gestiona" on trees
  for update using (tree_role(trees.id) = 'owner')
  with check (tree_role(trees.id) = 'owner');

drop policy if exists "trees_owner_borra" on trees;
create policy "trees_owner_borra" on trees for delete using (
  tree_role(trees.id) = 'owner'
);

-- ============ persons ============

drop policy if exists "persons_miembros_leen" on persons;
create policy "persons_miembros_leen" on persons for select using (
  tree_role(persons.tree_id) is not null
);

drop policy if exists "persons_editores_escriben" on persons;
create policy "persons_editores_escriben" on persons
  for insert with check (tree_role(persons.tree_id) in ('owner', 'editor'));

drop policy if exists "persons_editores_actualizan" on persons;
create policy "persons_editores_actualizan" on persons
  for update using (tree_role(persons.tree_id) in ('owner', 'editor'))
  with check (tree_role(persons.tree_id) in ('owner', 'editor'));

drop policy if exists "persons_editores_borran" on persons;
create policy "persons_editores_borran" on persons for delete using (
  tree_role(persons.tree_id) in ('owner', 'editor')
);

-- ============ unions ============

drop policy if exists "unions_miembros_leen" on unions;
create policy "unions_miembros_leen" on unions for select using (
  tree_role(unions.tree_id) is not null
);

drop policy if exists "unions_editores_escriben" on unions;
create policy "unions_editores_escriben" on unions
  for insert with check (tree_role(unions.tree_id) in ('owner', 'editor'));

drop policy if exists "unions_editores_actualizan" on unions;
create policy "unions_editores_actualizan" on unions
  for update using (tree_role(unions.tree_id) in ('owner', 'editor'))
  with check (tree_role(unions.tree_id) in ('owner', 'editor'));

drop policy if exists "unions_editores_borran" on unions;
create policy "unions_editores_borran" on unions for delete using (
  tree_role(unions.tree_id) in ('owner', 'editor')
);

-- ============ relationships ============

drop policy if exists "relationships_miembros_leen" on relationships;
create policy "relationships_miembros_leen" on relationships for select using (
  tree_role(relationships.tree_id) is not null
);

drop policy if exists "relationships_editores_escriben" on relationships;
create policy "relationships_editores_escriben" on relationships
  for insert with check (tree_role(relationships.tree_id) in ('owner', 'editor'));

drop policy if exists "relationships_editores_actualizan" on relationships;
create policy "relationships_editores_actualizan" on relationships
  for update using (tree_role(relationships.tree_id) in ('owner', 'editor'))
  with check (tree_role(relationships.tree_id) in ('owner', 'editor'));

drop policy if exists "relationships_editores_borran" on relationships;
create policy "relationships_editores_borran" on relationships for delete using (
  tree_role(relationships.tree_id) in ('owner', 'editor')
);

-- ============ tree_memberships (sin autorreferencia) ============

drop policy if exists "memberships_miembros_leen" on tree_memberships;
create policy "memberships_miembros_leen" on tree_memberships for select using (
  tree_role(tree_memberships.tree_id) is not null
);

drop policy if exists "memberships_owner_gestiona" on tree_memberships;
create policy "memberships_owner_gestiona" on tree_memberships
  for all using (tree_role(tree_memberships.tree_id) = 'owner')
  with check (tree_role(tree_memberships.tree_id) = 'owner');

-- ============ tree_invites ============

drop policy if exists "invites_miembros_leen" on tree_invites;
create policy "invites_miembros_leen" on tree_invites for select using (
  tree_role(tree_invites.tree_id) is not null
);

drop policy if exists "invites_editores_crean" on tree_invites;
create policy "invites_editores_crean" on tree_invites for insert with check (
  created_by = auth.uid()
  and tree_role(tree_invites.tree_id) in ('owner', 'editor')
);

drop policy if exists "invites_duenos_revocan" on tree_invites;
create policy "invites_duenos_revocan" on tree_invites
  for update using (tree_role(tree_invites.tree_id) = 'owner')
  with check (tree_role(tree_invites.tree_id) = 'owner');

-- ============ storage.objects ============

drop policy if exists "fotos_miembros_leen" on storage.objects;
create policy "fotos_miembros_leen" on storage.objects for select using (
  bucket_id = 'tree-photos'
  and tree_role((storage.foldername(name))[1]) is not null
);

drop policy if exists "fotos_editores_suben" on storage.objects;
create policy "fotos_editores_suben" on storage.objects for insert with check (
  bucket_id = 'tree-photos'
  and tree_role((storage.foldername(name))[1]) in ('owner', 'editor')
);

drop policy if exists "fotos_editores_borran" on storage.objects;
create policy "fotos_editores_borran" on storage.objects for delete using (
  bucket_id = 'tree-photos'
  and tree_role((storage.foldername(name))[1]) in ('owner', 'editor')
);
