import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Comment } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private sb = inject(SupabaseService);

  async listByCard(cardId: string): Promise<Comment[]> {
    const { data, error } = await this.sb
      .table('comments')
      .select('*, member:tb_members(*)')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Comment[];
  }

  async add(cardId: string, memberId: string | null, body: string): Promise<Comment> {
    const { data, error } = await this.sb
      .table('comments')
      .insert({ card_id: cardId, member_id: memberId, body })
      .select('*, member:tb_members(*)')
      .single();
    if (error) throw error;
    return data as Comment;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.sb.table('comments').delete().eq('id', id);
    if (error) throw error;
  }
}
