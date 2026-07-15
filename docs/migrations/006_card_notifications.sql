-- 006_card_notifications.sql — Notificar a los miembros asignados a una tarjeta
-- por comentarios y cambios relevantes (mover de lista, título, descripción,
-- fecha límite, archivado). SECURITY DEFINER: los triggers insertan
-- notificaciones para otros usuarios sin pasar por la política de INSERT.

-- Helper: notifica a todos los asignados de la tarjeta excepto el actor.
-- Anti-ruido: si hay una notificación no leída idéntica (<5 min), la refresca.
create or replace function public.notify_card_members(
  p_card_id uuid, p_actor uuid, p_type text, p_data jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_card record;
  r record;
  v_data jsonb;
begin
  select id, board_id, title into v_card from tb_cards where id = p_card_id;
  if v_card.id is null then
    return;
  end if;
  v_data := coalesce(p_data, '{}'::jsonb) || jsonb_build_object('title', v_card.title);
  for r in
    select member_id from tb_card_members
     where card_id = p_card_id
       and (p_actor is null or member_id <> p_actor)
  loop
    update tb_notifications
       set data = v_data, created_at = now()
     where member_id = r.member_id
       and card_id = p_card_id
       and type = p_type
       and actor_id is not distinct from p_actor
       and read = false
       and created_at > now() - interval '5 minutes';
    if not found then
      insert into tb_notifications (member_id, actor_id, type, board_id, card_id, data)
      values (r.member_id, p_actor, p_type, v_card.board_id, p_card_id, v_data);
    end if;
  end loop;
end;
$$;

-- Comentario nuevo → card.commented (el autor es el actor)
create or replace function public.trg_notify_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify_card_members(new.card_id, new.member_id, 'card.commented', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_tb_comments_notify on public.tb_comments;
create trigger trg_tb_comments_notify
  after insert on public.tb_comments
  for each row execute function public.trg_notify_comment();

-- Cambio relevante en la tarjeta → card.moved / card.updated
create or replace function public.trg_notify_card_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from text;
  v_to text;
begin
  if new.list_id is distinct from old.list_id then
    select title into v_from from tb_lists where id = old.list_id;
    select title into v_to from tb_lists where id = new.list_id;
    perform public.notify_card_members(new.id, v_actor, 'card.moved',
      jsonb_build_object('from_list', v_from, 'to_list', v_to));
  end if;
  -- Un guardado normal cambia un solo campo; prioridad si vinieran juntos.
  if new.archived is distinct from old.archived then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'archived', 'archived', new.archived));
  elsif new.due_date is distinct from old.due_date then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'due_date'));
  elsif new.title is distinct from old.title then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'title'));
  elsif new.description is distinct from old.description then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'description'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tb_cards_notify on public.tb_cards;
create trigger trg_tb_cards_notify
  after update on public.tb_cards
  for each row execute function public.trg_notify_card_update();

-- Solo los triggers usan estas funciones; sin acceso vía RPC.
revoke execute on function
  public.notify_card_members(uuid, uuid, text, jsonb),
  public.trg_notify_comment(),
  public.trg_notify_card_update()
from public, anon, authenticated;
