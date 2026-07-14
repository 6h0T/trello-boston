import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Board, Member } from '../models/models';

@Injectable({ providedIn: 'root' })
export class BoardsService {
  private sb = inject(SupabaseService);

  async list(): Promise<Board[]> {
    const { data, error } = await this.sb
      .table('boards')
      .select('*, board_members:tb_board_members(member:tb_members(*))')
      .order('starred', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((b: any) => ({
      ...b,
      members: (b.board_members ?? []).map((bm: any) => bm.member).filter(Boolean) as Member[],
    })) as Board[];
  }

  async get(id: string): Promise<Board | null> {
    const { data, error } = await this.sb
      .table('boards')
      .select('*, board_members:tb_board_members(member:tb_members(*))')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...(data as any),
      members: ((data as any).board_members ?? [])
        .map((bm: any) => bm.member)
        .filter(Boolean) as Member[],
    } as Board;
  }

  async create(
    title: string,
    background: string,
    createdBy: string | null,
  ): Promise<Board> {
    const { data, error } = await this.sb
      .table('boards')
      .insert({ title, background, created_by: createdBy })
      .select()
      .single();
    if (error) throw error;
    const board = data as Board;
    if (createdBy) {
      await this.sb
        .table('board_members')
        .upsert({ board_id: board.id, member_id: createdBy, role: 'admin' });
    }
    return board;
  }

  /**
   * Create a board together with its initial columns (1–3 named lists).
   * Returns the created board with its lists hydrated.
   */
  async createWithLists(
    title: string,
    background: string,
    createdBy: string | null,
    listNames: string[],
  ): Promise<Board> {
    const board = await this.create(title, background, createdBy);
    const names = (listNames ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 3);
    if (names.length) {
      const rows = names.map((title, i) => ({
        board_id: board.id,
        title,
        position: (i + 1) * 1000,
      }));
      const { data, error } = await this.sb.table('lists').insert(rows).select();
      if (error) throw error;
      board.lists = data as any;
    }
    return board;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<Board, 'title' | 'description' | 'background' | 'background_image_url' | 'starred'>
    >,
  ): Promise<void> {
    const { error } = await this.sb
      .table('boards')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async toggleStar(id: string, starred: boolean): Promise<void> {
    return this.update(id, { starred });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('boards').delete().eq('id', id);
    if (error) throw error;
  }

  async addMember(boardId: string, memberId: string, role = 'member'): Promise<void> {
    const { error } = await this.sb
      .table('board_members')
      .upsert({ board_id: boardId, member_id: memberId, role });
    if (error) throw error;
  }

  async removeMember(boardId: string, memberId: string): Promise<void> {
    const { error } = await this.sb
      .table('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('member_id', memberId);
    if (error) throw error;
  }
}
