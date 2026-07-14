import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { List } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ListsService {
  private sb = inject(SupabaseService);

  async listByBoard(boardId: string, includeArchived = false): Promise<List[]> {
    let q = this.sb.table('lists').select('*').eq('board_id', boardId);
    if (!includeArchived) q = q.eq('archived', false);
    const { data, error } = await q.order('position');
    if (error) throw error;
    return data as List[];
  }

  async create(boardId: string, title: string, position: number): Promise<List> {
    const { data, error } = await this.sb
      .table('lists')
      .insert({ board_id: boardId, title, position })
      .select()
      .single();
    if (error) throw error;
    return data as List;
  }

  async rename(id: string, title: string): Promise<void> {
    const { error } = await this.sb.table('lists').update({ title }).eq('id', id);
    if (error) throw error;
  }

  async setPosition(id: string, position: number): Promise<void> {
    const { error } = await this.sb.table('lists').update({ position }).eq('id', id);
    if (error) throw error;
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    const { error } = await this.sb.table('lists').update({ archived }).eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('lists').delete().eq('id', id);
    if (error) throw error;
  }
}
