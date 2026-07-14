// ============================================================
// Domain models — aligned 1:1 with Supabase tb_* columns (snake_case)
// to avoid mapping bugs across the feature teams.
// ============================================================

export interface Member {
  id: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  color: string;
  created_at?: string;
}

export type BoardBackground =
  | 'navy' | 'blue' | 'teal' | 'violet'
  | 'rose' | 'amber' | 'slate' | 'emerald';

export interface Board {
  id: string;
  title: string;
  description?: string | null;
  background: BoardBackground | string;
  /** Imagen de fondo subida por el usuario; si existe, manda sobre `background`. */
  background_image_url?: string | null;
  starred: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // hydrated (optional)
  members?: Member[];
  lists?: List[];
}

export interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
  archived: boolean;
  created_at?: string;
  // hydrated
  cards?: Card[];
}

export interface Label {
  id: string;
  board_id: string;
  name?: string | null;
  color: string;
  created_at?: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at?: string;
}

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  created_at?: string;
  items?: ChecklistItem[];
}

export interface Comment {
  id: string;
  card_id: string;
  member_id?: string | null;
  body: string;
  created_at?: string;
  member?: Member | null;
}

export type AttachmentType = 'image' | 'video' | 'link' | 'file';

/** Tamaño de la cubierta de una tarjeta: franja superior o tarjeta completa. */
export type CardCoverSize = 'strip' | 'full';

export interface Attachment {
  id: string;
  card_id: string;
  name: string;
  url: string;
  type?: AttachmentType | string;
  created_at?: string;
}

export interface Card {
  id: string;
  list_id: string;
  board_id: string;
  title: string;
  description?: string | null;
  position: number;
  due_date?: string | null;
  due_complete: boolean;
  cover_color?: string | null;
  cover_size?: CardCoverSize;
  progress?: number; // 0-100
  body_html?: string | null; // contenido rico del apartado "General"
  archived: boolean;
  created_at?: string;
  updated_at?: string;
  // hydrated
  labels?: Label[];
  members?: Member[];
  checklists?: Checklist[];
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface Activity {
  id: string;
  board_id: string;
  card_id?: string | null;
  member_id?: string | null;
  type: string;
  data: Record<string, any>;
  created_at?: string;
  member?: Member | null;
}

export interface Notification {
  id: string;
  member_id: string;
  actor_id?: string | null;
  type: string; // 'card.assigned' | 'card.commented' | 'card.mentioned' | ...
  board_id?: string | null;
  card_id?: string | null;
  data: Record<string, any>;
  read: boolean;
  created_at?: string;
  actor?: Member | null;
}

// Label color palette (Trello-like)
export const LABEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#2563eb', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#64748b', '#0f172a',
];

export const BOARD_BACKGROUNDS: { key: BoardBackground; label: string; class: string }[] = [
  { key: 'navy', label: 'Navy', class: 'bg-board-navy' },
  { key: 'blue', label: 'Azul', class: 'bg-board-blue' },
  { key: 'teal', label: 'Teal', class: 'bg-board-teal' },
  { key: 'violet', label: 'Violeta', class: 'bg-board-violet' },
  { key: 'rose', label: 'Rosa', class: 'bg-board-rose' },
  { key: 'amber', label: 'Ámbar', class: 'bg-board-amber' },
  { key: 'slate', label: 'Slate', class: 'bg-board-slate' },
  { key: 'emerald', label: 'Esmeralda', class: 'bg-board-emerald' },
];

export function boardBgClass(bg: string | undefined | null): string {
  const found = BOARD_BACKGROUNDS.find((b) => b.key === bg);
  return found ? found.class : 'bg-board-navy';
}

// Solid colors used to tint the top navbar to match each board background.
export const BOARD_NAV_COLORS: Record<string, string> = {
  navy: '#1d3969',
  blue: '#1e40af',
  teal: '#115e59',
  violet: '#5b21b6',
  rose: '#9f1239',
  amber: '#92400e',
  slate: '#1e293b',
  emerald: '#065f46',
};

export function boardNavColor(bg: string | undefined | null): string {
  return BOARD_NAV_COLORS[bg ?? 'navy'] ?? '#1d3969';
}
