// Smoke test: valida que las consultas con embeds de PostgREST funcionan.
import { createClient } from '@supabase/supabase-js';

const url = 'https://irdzqnwkxjlinufbtggx.supabase.co';
const key = 'sb_publishable_uZedCbwRdfz3hsarPYxf9Q_e-HzgCmj';
const sb = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const check = (label, error, sample) => {
  if (error) { failures++; console.log(`❌ ${label}: ${error.message}`); }
  else console.log(`✅ ${label}${sample !== undefined ? ' → ' + sample : ''}`);
};

// 1) boards + board_members embed
const boards = await sb.from('tb_boards').select('*, board_members:tb_board_members(member:tb_members(*))').order('created_at');
check('boards + members', boards.error, `${boards.data?.length} boards, 1º miembros=${boards.data?.[0]?.board_members?.length}`);

const boardId = boards.data?.[0]?.id;

// 2) lists
const lists = await sb.from('tb_lists').select('*').eq('board_id', boardId).order('position');
check('lists', lists.error, `${lists.data?.length} listas`);

// 3) cards + labels + members embed
const cards = await sb.from('tb_cards').select('*, card_labels:tb_card_labels(label:tb_labels(*)), card_members:tb_card_members(member:tb_members(*))').eq('board_id', boardId);
check('cards + labels + members', cards.error, `${cards.data?.length} cards`);

const cardId = cards.data?.find(c => c.title?.includes('dashboard'))?.id ?? cards.data?.[0]?.id;

// 4) getFull embed (checklists.items, comments.member, attachments)
const full = await sb.from('tb_cards').select(`*,
  card_labels:tb_card_labels(label:tb_labels(*)),
  card_members:tb_card_members(member:tb_members(*)),
  checklists:tb_checklists(*, items:tb_checklist_items(*)),
  comments:tb_comments(*, member:tb_members(*)),
  attachments:tb_attachments(*)`).eq('id', cardId).maybeSingle();
check('getFull (card completa)', full.error,
  full.data ? `checklists=${full.data.checklists?.length} items=${full.data.checklists?.[0]?.items?.length} comments=${full.data.comments?.length}` : 'null');

// 5) members
const members = await sb.from('tb_members').select('*').order('name');
check('members', members.error, `${members.data?.length} usuarios`);

// 6) activity + member embed
const activity = await sb.from('tb_activity').select('*, member:tb_members(*)').eq('board_id', boardId).limit(5);
check('activity', activity.error, `${activity.data?.length} entradas`);

// 7) write test: create + delete a card (valida RLS de escritura)
const created = await sb.from('tb_cards').insert({ list_id: lists.data?.[0]?.id, board_id: boardId, title: '__smoke_test__', position: 99999 }).select().single();
check('insert card (RLS escritura)', created.error, created.data?.id);
if (created.data?.id) {
  const del = await sb.from('tb_cards').delete().eq('id', created.data.id);
  check('delete card', del.error, 'ok');
}

console.log(failures === 0 ? '\n🎉 TODAS LAS CONSULTAS OK' : `\n⚠️ ${failures} fallos`);
process.exit(failures === 0 ? 0 : 1);
