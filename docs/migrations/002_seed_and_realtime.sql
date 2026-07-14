-- ============================================================
-- TRELLO-BOSTON — Realtime + datos de ejemplo (seed)
-- Ejecutar DESPUÉS de 001_schema.sql
-- ============================================================

-- 1) Habilitar Realtime en las tablas relevantes
do $$
declare t text;
begin
  foreach t in array array[
    'tb_boards','tb_lists','tb_cards','tb_card_members','tb_card_labels',
    'tb_checklists','tb_checklist_items','tb_comments','tb_activity','tb_labels'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 2) Seed idempotente (solo si no existen miembros tb_)
do $$
declare
  m_ana uuid; m_leo uuid; m_sofia uuid; m_diego uuid; m_caro uuid;
  b_id uuid;
  l_back uuid; l_todo uuid; l_prog uuid; l_done uuid;
  lab_high uuid; lab_bug uuid; lab_feat uuid; lab_design uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  cl1 uuid;
begin
  if exists (select 1 from public.tb_members limit 1) then
    return;
  end if;

  insert into public.tb_members(name,email,color) values ('Ana Ríos','ana@bostonam.com','#2563eb') returning id into m_ana;
  insert into public.tb_members(name,email,color) values ('Leo Méndez','leo@bostonam.com','#059669') returning id into m_leo;
  insert into public.tb_members(name,email,color) values ('Sofía Vera','sofia@bostonam.com','#db2777') returning id into m_sofia;
  insert into public.tb_members(name,email,color) values ('Diego Paz','diego@bostonam.com','#d97706') returning id into m_diego;
  insert into public.tb_members(name,email,color) values ('Caro Luna','caro@bostonam.com','#7c3aed') returning id into m_caro;

  insert into public.tb_boards(title,description,background,starred,created_by)
    values ('Boston AM — Roadmap','Tablero de producto y operaciones','navy',true,m_ana)
    returning id into b_id;

  insert into public.tb_board_members(board_id,member_id,role) values
    (b_id,m_ana,'admin'),(b_id,m_leo,'member'),(b_id,m_sofia,'member'),
    (b_id,m_diego,'member'),(b_id,m_caro,'member');

  insert into public.tb_labels(board_id,name,color) values (b_id,'Prioridad alta','#ef4444') returning id into lab_high;
  insert into public.tb_labels(board_id,name,color) values (b_id,'Bug','#f97316') returning id into lab_bug;
  insert into public.tb_labels(board_id,name,color) values (b_id,'Feature','#22c55e') returning id into lab_feat;
  insert into public.tb_labels(board_id,name,color) values (b_id,'Diseño','#8b5cf6') returning id into lab_design;

  insert into public.tb_lists(board_id,title,position) values (b_id,'Backlog',1000) returning id into l_back;
  insert into public.tb_lists(board_id,title,position) values (b_id,'To Do',2000) returning id into l_todo;
  insert into public.tb_lists(board_id,title,position) values (b_id,'En progreso',3000) returning id into l_prog;
  insert into public.tb_lists(board_id,title,position) values (b_id,'Hecho',4000) returning id into l_done;

  insert into public.tb_cards(list_id,board_id,title,description,position,due_date,cover_color)
    values (l_todo,b_id,'Diseñar dashboard de cartera','Wireframe + UI kit Boston',1000, now()+interval '3 days','#2563eb') returning id into c1;
  insert into public.tb_cards(list_id,board_id,title,description,position)
    values (l_todo,b_id,'Integrar API de cotizaciones','REST + websockets',2000) returning id into c2;
  insert into public.tb_cards(list_id,board_id,title,description,position)
    values (l_prog,b_id,'Autenticación de clientes','Login + roles',1000) returning id into c3;
  insert into public.tb_cards(list_id,board_id,title,description,position,due_date,due_complete)
    values (l_done,b_id,'Setup de infraestructura','CI/CD + Supabase',1000, now()-interval '2 days', true) returning id into c4;
  insert into public.tb_cards(list_id,board_id,title,description,position)
    values (l_back,b_id,'Reportes PDF','Exportar carteras a PDF',1000) returning id into c5;
  insert into public.tb_cards(list_id,board_id,title,description,position)
    values (l_back,b_id,'Notificaciones por email','Resúmenes semanales',2000) returning id into c6;

  insert into public.tb_card_labels(card_id,label_id) values (c1,lab_design),(c1,lab_high),(c2,lab_feat),(c3,lab_high),(c4,lab_feat);
  insert into public.tb_card_members(card_id,member_id) values (c1,m_sofia),(c1,m_ana),(c2,m_leo),(c3,m_diego),(c4,m_leo);

  insert into public.tb_checklists(card_id,title) values (c1,'Entregables') returning id into cl1;
  insert into public.tb_checklist_items(checklist_id,text,done,position) values
    (cl1,'Definir paleta',true,1000),(cl1,'Maquetar cards',false,2000),(cl1,'Revisión con equipo',false,3000);

  insert into public.tb_comments(card_id,member_id,body) values (c1,m_ana,'Usemos el navy #1d3969 del UI kit.');
  insert into public.tb_activity(board_id,card_id,member_id,type,data) values
    (b_id,c4,m_leo,'card.completed','{"title":"Setup de infraestructura"}'::jsonb);
end $$;
