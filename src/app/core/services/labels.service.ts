import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Label } from '../models/models';

@Injectable({ providedIn: 'root' })
export class LabelsService {
  private sb = inject(SupabaseService);

  async listByBoard(boardId: string): Promise<Label[]> {
    const { data, error } = await this.sb
      .table('labels')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at');
    if (error) throw error;
    return data as Label[];
  }

  async create(boardId: string, name: string, color: string): Promise<Label> {
    const { data, error } = await this.sb
      .table('labels')
      .insert({ board_id: boardId, name, color })
      .select()
      .single();
    if (error) throw error;
    return data as Label;
  }

  async update(id: string, patch: Partial<Pick<Label, 'name' | 'color'>>): Promise<void> {
    const { error } = await this.sb.table('labels').update(patch).eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('labels').delete().eq('id', id);
    if (error) throw error;
  }

  async addToCard(cardId: string, labelId: string): Promise<void> {
    const { error } = await this.sb
      .table('card_labels')
      .upsert({ card_id: cardId, label_id: labelId });
    if (error) throw error;
  }

  async removeFromCard(cardId: string, labelId: string): Promise<void> {
    const { error } = await this.sb
      .table('card_labels')
      .delete()
      .eq('card_id', cardId)
      .eq('label_id', labelId);
    if (error) throw error;
  }
}
