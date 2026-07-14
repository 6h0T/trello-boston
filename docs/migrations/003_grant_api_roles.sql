-- ============================================================
-- TRELLO-BOSTON — GRANTs para los roles de la API (anon, authenticated)
-- Necesario para que PostgREST exponga las tablas en la REST API.
-- Ejecutar tras 001_schema.sql. RLS sigue gobernando el acceso por fila.
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
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated;', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- Recargar la caché de PostgREST.
-- IMPORTANTE: ejecuta esto desde el SQL Editor web de Supabase, NO por el pooler.
notify pgrst, 'reload schema';
