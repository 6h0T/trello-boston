import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';

/**
 * Subscribes to all board-scoped table changes (lists, cards, labels, etc.)
 * and invokes `onChange` so the board view can refresh.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private sb = inject(SupabaseService);

  subscribeBoard(boardId: string, onChange: () => void): RealtimeChannel {
    const channel = this.sb.client.channel(`board-${boardId}`);
    // Tables that carry board_id can be filtered server-side.
    for (const table of ['tb_lists', 'tb_cards', 'tb_labels']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `board_id=eq.${boardId}` },
        () => onChange(),
      );
    }
    // Junction / child tables have no board_id — listen broadly and let the view refresh.
    for (const table of ['tb_card_members', 'tb_card_labels', 'tb_checklists', 'tb_checklist_items', 'tb_comments']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
    }
    channel.subscribe();
    return channel;
  }

  unsubscribe(channel: RealtimeChannel) {
    this.sb.client.removeChannel(channel);
  }
}
