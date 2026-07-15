-- 005_roles_and_rls.sql — Rol global admin/empleado + RLS por membresía de tablero.
-- Reemplaza las políticas abiertas (USING true) de 001_schema.sql.

-- 1) Rol global en el perfil
alter table public.tb_members
  add column if not exists role text not null default 'empleado'
  check (role in ('admin','empleado'));

update public.tb_members set role = 'admin'
 where email in ('admin@bostonam.com','soledadc@bostonam.com');

-- 2) Helpers SECURITY DEFINER (evitan recursión RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from tb_members where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_board(bid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or exists (select 1 from tb_board_members
                  where board_id = bid and member_id = auth.uid())
      or exists (select 1 from tb_boards
                  where id = bid and created_by = auth.uid());
$$;

create or replace function public.can_access_card(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from tb_cards c
     where c.id = cid and public.can_access_board(c.board_id)
  );
$$;

grant execute on function public.is_admin(), public.can_access_board(uuid), public.can_access_card(uuid) to authenticated;

-- 3) Solo un admin puede cambiar roles (ni siquiera el propio)
create or replace function public.tb_members_protect_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tb_members_protect_role on public.tb_members;
create trigger trg_tb_members_protect_role
  before update on public.tb_members
  for each row execute function public.tb_members_protect_role();

-- 4) Políticas RLS
-- tb_members: roster visible para autenticados (asignaciones y menciones)
drop policy if exists tb_members_all on public.tb_members;
create policy tb_members_select on public.tb_members
  for select to authenticated using (true);
create policy tb_members_insert on public.tb_members
  for insert to authenticated with check (id = auth.uid());
create policy tb_members_update on public.tb_members
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy tb_members_delete on public.tb_members
  for delete to authenticated using (public.is_admin());

-- tb_boards
drop policy if exists tb_boards_all on public.tb_boards;
create policy tb_boards_select on public.tb_boards
  for select to authenticated using (public.can_access_board(id));
create policy tb_boards_insert on public.tb_boards
  for insert to authenticated with check (created_by = auth.uid());
create policy tb_boards_update on public.tb_boards
  for update to authenticated
  using (public.can_access_board(id)) with check (public.can_access_board(id));
create policy tb_boards_delete on public.tb_boards
  for delete to authenticated using (public.can_access_board(id));

-- tb_board_members (el creador entra por created_by en can_access_board)
drop policy if exists tb_board_members_all on public.tb_board_members;
create policy tb_board_members_rw on public.tb_board_members
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Tablas con board_id directo
drop policy if exists tb_lists_all on public.tb_lists;
create policy tb_lists_rw on public.tb_lists
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_labels_all on public.tb_labels;
create policy tb_labels_rw on public.tb_labels
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_activity_all on public.tb_activity;
create policy tb_activity_rw on public.tb_activity
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_cards_all on public.tb_cards;
create policy tb_cards_rw on public.tb_cards
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Tablas hijas de tarjeta (card_id)
drop policy if exists tb_card_labels_all on public.tb_card_labels;
create policy tb_card_labels_rw on public.tb_card_labels
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_card_members_all on public.tb_card_members;
create policy tb_card_members_rw on public.tb_card_members
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_checklists_all on public.tb_checklists;
create policy tb_checklists_rw on public.tb_checklists
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_comments_all on public.tb_comments;
create policy tb_comments_rw on public.tb_comments
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_attachments_all on public.tb_attachments;
create policy tb_attachments_rw on public.tb_attachments
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

-- tb_checklist_items: vía checklist → tarjeta
drop policy if exists tb_checklist_items_all on public.tb_checklist_items;
create policy tb_checklist_items_rw on public.tb_checklist_items
  for all to authenticated
  using (exists (select 1 from public.tb_checklists cl
                  where cl.id = checklist_id and public.can_access_card(cl.card_id)))
  with check (exists (select 1 from public.tb_checklists cl
                  where cl.id = checklist_id and public.can_access_card(cl.card_id)));

-- tb_notifications: solo el destinatario las ve/gestiona; cualquiera autenticado
-- puede crear notificaciones actuando como sí mismo (menciones, asignaciones)
drop policy if exists tb_notifications_all on public.tb_notifications;
create policy tb_notifications_select on public.tb_notifications
  for select to authenticated using (member_id = auth.uid());
create policy tb_notifications_insert on public.tb_notifications
  for insert to authenticated with check (actor_id = auth.uid());
create policy tb_notifications_update on public.tb_notifications
  for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy tb_notifications_delete on public.tb_notifications
  for delete to authenticated using (member_id = auth.uid());
