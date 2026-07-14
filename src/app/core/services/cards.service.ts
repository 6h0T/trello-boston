import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Card } from '../models/models';

function hydrate(row: any): Card {
  return {
    ...row,
    labels: (row.card_labels ?? []).map((cl: any) => cl.label).filter(Boolean),
    members: (row.card_members ?? []).map((cm: any) => cm.member).filter(Boolean),
    checklists: (row.checklists ?? [])
      .map((c: any) => ({ ...c, items: (c.items ?? []).sort((a: any, b: any) => a.position - b.position) }))
      .sort((a: any, b: any) => a.position - b.position),
    comments: (row.comments ?? []).sort(
      (a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    ),
    attachments: row.attachments ?? [],
  } as Card;
}

@Injectable({ providedIn: 'root' })
export class CardsService {
  private sb = inject(SupabaseService);

  /** Lightweight cards for board rendering (labels + members only). */
  async listByBoard(boardId: string): Promise<Card[]> {
    const { data, error } = await this.sb
      .table('cards')
      .select('*, card_labels:tb_card_labels(label:tb_labels(*)), card_members:tb_card_members(member:tb_members(*))')
      .eq('board_id', boardId)
      .eq('archived', false)
      .order('position');
    if (error) throw error;
    return (data ?? []).map(hydrate);
  }

  /** All non-archived cards assigned to a member, across every board.
   *  Each returned card also carries a `board` field ({id,title,background}). */
  async listAssignedTo(memberId: string): Promise<Card[]> {
    const { data, error } = await this.sb
      .table('cards')
      .select(
        '*, card_members:tb_card_members!inner(member_id), card_labels:tb_card_labels(label:tb_labels(*)), board:tb_boards(id,title,background)',
      )
      .eq('card_members.member_id', memberId)
      .eq('archived', false)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(hydrate);
  }

  async listArchived(boardId: string): Promise<Card[]> {
    const { data, error } = await this.sb
      .table('cards')
      .select('*')
      .eq('board_id', boardId)
      .eq('archived', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data as Card[];
  }

  /** Full card detail with checklists, comments, attachments. */
  async getFull(cardId: string): Promise<Card | null> {
    const { data, error } = await this.sb
      .table('cards')
      .select(
        `*,
         card_labels:tb_card_labels(label:tb_labels(*)),
         card_members:tb_card_members(member:tb_members(*)),
         checklists:tb_checklists(*, items:tb_checklist_items(*)),
         comments:tb_comments(*, member:tb_members(*)),
         attachments:tb_attachments(*)`,
      )
      .eq('id', cardId)
      .maybeSingle();
    if (error) throw error;
    return data ? hydrate(data) : null;
  }

  async create(listId: string, boardId: string, title: string, position: number): Promise<Card> {
    const { data, error } = await this.sb
      .table('cards')
      .insert({ list_id: listId, board_id: boardId, title, position })
      .select('*, card_labels:tb_card_labels(label:tb_labels(*)), card_members:tb_card_members(member:tb_members(*))')
      .single();
    if (error) throw error;
    return hydrate(data);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Card,
        | 'title'
        | 'description'
        | 'due_date'
        | 'due_complete'
        | 'cover_color'
        | 'cover_size'
        | 'archived'
        | 'progress'
        | 'body_html'
      >
    >,
  ): Promise<void> {
    const { error } = await this.sb
      .table('cards')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async move(id: string, listId: string, position: number): Promise<void> {
    const { error } = await this.sb
      .table('cards')
      .update({ list_id: listId, position, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  /** Move a card to a different board (and one of its lists). */
  async moveToBoard(id: string, boardId: string, listId: string, position: number): Promise<void> {
    const { error } = await this.sb
      .table('cards')
      .update({ board_id: boardId, list_id: listId, position, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    return this.update(id, { archived });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('cards').delete().eq('id', id);
    if (error) throw error;
  }

  async addMember(cardId: string, memberId: string): Promise<void> {
    const { error } = await this.sb
      .table('card_members')
      .upsert({ card_id: cardId, member_id: memberId });
    if (error) throw error;
  }

  async removeMember(cardId: string, memberId: string): Promise<void> {
    const { error } = await this.sb
      .table('card_members')
      .delete()
      .eq('card_id', cardId)
      .eq('member_id', memberId);
    if (error) throw error;
  }
}
