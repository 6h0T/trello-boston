import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Attachment, AttachmentType } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private sb = inject(SupabaseService);

  async listByCard(cardId: string): Promise<Attachment[]> {
    const { data, error } = await this.sb
      .table('attachments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Attachment[];
  }

  async add(cardId: string, name: string, url: string, type: AttachmentType): Promise<Attachment> {
    const { data, error } = await this.sb
      .table('attachments')
      .insert({ card_id: cardId, name, url, type })
      .select()
      .single();
    if (error) throw error;
    return data as Attachment;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('attachments').delete().eq('id', id);
    if (error) throw error;
  }
}
