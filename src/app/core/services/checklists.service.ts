import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Checklist, ChecklistItem } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ChecklistsService {
  private sb = inject(SupabaseService);

  async create(cardId: string, title: string, position: number): Promise<Checklist> {
    const { data, error } = await this.sb
      .table('checklists')
      .insert({ card_id: cardId, title, position })
      .select()
      .single();
    if (error) throw error;
    return { ...(data as Checklist), items: [] };
  }

  async rename(id: string, title: string): Promise<void> {
    const { error } = await this.sb.table('checklists').update({ title }).eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('checklists').delete().eq('id', id);
    if (error) throw error;
  }

  async addItem(checklistId: string, text: string, position: number): Promise<ChecklistItem> {
    const { data, error } = await this.sb
      .table('checklist_items')
      .insert({ checklist_id: checklistId, text, position })
      .select()
      .single();
    if (error) throw error;
    return data as ChecklistItem;
  }

  async toggleItem(id: string, done: boolean): Promise<void> {
    const { error } = await this.sb.table('checklist_items').update({ done }).eq('id', id);
    if (error) throw error;
  }

  async updateItem(id: string, text: string): Promise<void> {
    const { error } = await this.sb.table('checklist_items').update({ text }).eq('id', id);
    if (error) throw error;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.sb.table('checklist_items').delete().eq('id', id);
    if (error) throw error;
  }
}
