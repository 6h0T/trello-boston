import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Activity } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private sb = inject(SupabaseService);

  async listByBoard(boardId: string, limit = 50): Promise<Activity[]> {
    const { data, error } = await this.sb
      .table('activity')
      .select('*, member:member_id(*)')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as Activity[];
  }

  async log(
    boardId: string,
    type: string,
    opts: { cardId?: string | null; memberId?: string | null; data?: Record<string, any> } = {},
  ): Promise<void> {
    const { error } = await this.sb.table('activity').insert({
      board_id: boardId,
      card_id: opts.cardId ?? null,
      member_id: opts.memberId ?? null,
      type,
      data: opts.data ?? {},
    });
    if (error) throw error;
  }
}
