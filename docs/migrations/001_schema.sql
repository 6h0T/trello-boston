-- ============================================================
-- TRELLO-BOSTON — Esquema (prefijo tb_)
-- Proyecto Supabase: irdzqnwkxjlinufbtggx
-- Ejecutar en: Supabase Studio → SQL Editor → New query
-- ============================================================

create extension if not exists pgcrypto;

-- Miembros (usuarios mock seleccionables, sin password)
create table if not exists public.tb_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  avatar_url text,
  color text default '#2563eb',
  created_at timestamptz not null default now()
);

-- Tableros
create table if not exists public.tb_boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  background text default 'navy',
  starred boolean not null default false,
  created_by uuid references public.tb_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membresía de tableros
create table if not exists public.tb_board_members (
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  member_id uuid not null references public.tb_members(id) on delete cascade,
  role text not null default 'member',
  primary key (board_id, member_id)
);

-- Listas (columnas)
create table if not exists public.tb_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  title text not null,
  position double precision not null default 1000,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tarjetas
create table if not exists public.tb_cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.tb_lists(id) on delete cascade,
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  title text not null,
  description text,
  position double precision not null default 1000,
  due_date timestamptz,
  due_complete boolean not null default false,
  cover_color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Etiquetas
create table if not exists public.tb_labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  name text,
  color text not null,
  created_at timestamptz not null default now()
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

-- Checklists
create table if not exists public.tb_checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  title text not null default 'Checklist',
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists public.tb_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.tb_checklists(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);

-- Comentarios
create table if not exists public.tb_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  member_id uuid references public.tb_members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Adjuntos
create table if not exists public.tb_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tb_cards(id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- Actividad / log
create table if not exists public.tb_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.tb_boards(id) on delete cascade,
  card_id uuid references public.tb_cards(id) on delete set null,
  member_id uuid references public.tb_members(id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_tb_lists_board on public.tb_lists(board_id);
create index if not exists idx_tb_cards_list on public.tb_cards(list_id);
create index if not exists idx_tb_cards_board on public.tb_cards(board_id);
create index if not exists idx_tb_labels_board on public.tb_labels(board_id);
create index if not exists idx_tb_checklists_card on public.tb_checklists(card_id);
create index if not exists idx_tb_checklist_items_cl on public.tb_checklist_items(checklist_id);
create index if not exists idx_tb_comments_card on public.tb_comments(card_id);
create index if not exists idx_tb_activity_board on public.tb_activity(board_id);

-- ============================================================
-- RLS: la app usa la key publishable (rol anon) con auth mock.
-- Políticas permisivas (demo multiusuario sin login real).
-- En producción real se endurecerían con auth de Supabase.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'tb_members','tb_boards','tb_board_members','tb_lists','tb_cards',
    'tb_labels','tb_card_labels','tb_card_members','tb_checklists',
    'tb_checklist_items','tb_comments','tb_attachments','tb_activity'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true);',
      t||'_all', t
    );
  end loop;
end $$;
