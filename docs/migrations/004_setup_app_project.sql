-- ============================================================
-- TRELLO-BOSTON — Setup completo e IDEMPOTENTE para el proyecto de la APP
-- Proyecto: irdzqnwkxjlinufbtggx  (el de environment.ts)
-- Ejecutar en: Supabase Studio de ESE proyecto → SQL Editor → Run.
-- No borra datos: solo crea lo que falte (tablas, columnas, políticas, bucket).
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.tb_members (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, avatar_url text,
  color text default '#2563eb', created_at timestamptz not null default now()
);
create table if not exists public.tb_boards (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, background text default 'navy',
  starred boolean not null default false,
  created_by uuid references public.tb_members(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tb_board_members (
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  member_id uuid not null references public.tb_members(id) on delete cascade,
  role text not null default 'member', primary key (board_id, member_id)
);
create table if not exists public.tb_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  title text not null, position double precision not null default 1000,
  archived boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.tb_cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.tb_lists(id) on delete cascade,
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  title text not null, description text, position double precision not null default 1000,
  due_date timestamptz, due_complete boolean not null default false,
  cover_color text, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tb_labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  name text, color text not null, created_at timestamptz not null default now()
);
create table if not exists public.tb_card_labels (
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  label_id uuid not null references public.tb_labels(id) on delete cascade,
  primary key (card_id, label_id)
);
create table if not exists public.tb_card_members (
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  member_id uuid not null references public.tb_members(id) on delete cascade,
  primary key (card_id, member_id)
);
create table if not exists public.tb_checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  title text not null default 'Checklist', position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create table if not exists public.tb_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.tb_checklists(id) on delete cascade,
  text text not null, done boolean not null default false,
  position double precision not null default 1000, created_at timestamptz not null default now()
);
create table if not exists public.tb_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  member_id uuid references public.tb_members(id) on delete set null,
  body text not null, created_at timestamptz not null default now()
);
create table if not exists public.tb_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  name text not null, url text not null, created_at timestamptz not null default now()
);
create table if not exists public.tb_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  card_id uuid references public.tb_cards(id) on delete set null,
  member_id uuid references public.tb_members(id) on delete set null,
  type text not null, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.tb_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tb_members(id) on delete cascade,
  actor_id uuid references public.tb_members(id) on delete set null,
  type text not null,
  board_id uuid references public.tb_boards(id) on delete cascade,
  card_id uuid references public.tb_cards(id) on delete cascade,
  data jsonb not null default '{}'::jsonb, read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Columnas nuevas (features)
alter table public.tb_cards add column if not exists progress smallint not null default 0;
alter table public.tb_cards add column if not exists body_html text;
alter table public.tb_attachments add column if not exists type text not null default 'file';

-- Índices
create index if not exists idx_tb_lists_board on public.tb_lists(board_id);
create index if not exists idx_tb_cards_list on public.tb_cards(list_id);
create index if not exists idx_tb_cards_board on public.tb_cards(board_id);
create index if not exists idx_tb_notifications_member on public.tb_notifications(member_id, read, created_at desc);

-- RLS + políticas permisivas (demo) + GRANTS para que PostgREST exponga las tablas
do $$
declare t text;
begin
  foreach t in array array[
    'tb_members','tb_boards','tb_board_members','tb_lists','tb_cards','tb_labels',
    'tb_card_labels','tb_card_members','tb_checklists','tb_checklist_items',
    'tb_comments','tb_attachments','tb_activity','tb_notifications'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_all', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true);', t||'_all', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated;', t);
  end loop;
end $$;
grant usage on schema public to anon, authenticated;

-- Realtime
do $$
declare t text;
begin
  foreach t in array array['tb_boards','tb_lists','tb_cards','tb_card_members','tb_card_labels',
    'tb_checklists','tb_checklist_items','tb_comments','tb_activity','tb_labels','tb_notifications'] loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Storage: bucket público para imágenes/medios (pegar/adjuntar)
insert into storage.buckets (id, name, public) values ('tb-media','tb-media', true)
on conflict (id) do update set public = true;
drop policy if exists tb_media_all_select on storage.objects;
drop policy if exists tb_media_all_write on storage.objects;
drop policy if exists tb_media_all_update on storage.objects;
drop policy if exists tb_media_all_delete on storage.objects;
create policy tb_media_all_select on storage.objects for select to anon, authenticated using (bucket_id = 'tb-media');
create policy tb_media_all_write  on storage.objects for insert to anon, authenticated with check (bucket_id = 'tb-media');
create policy tb_media_all_update on storage.objects for update to anon, authenticated using (bucket_id = 'tb-media') with check (bucket_id = 'tb-media');
create policy tb_media_all_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'tb-media');

-- Recargar la caché de PostgREST (en SQL Editor web sí llega)
notify pgrst, 'reload schema';
