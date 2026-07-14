import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { Notification } from '../models/models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private sb = inject(SupabaseService);

  async listForMember(memberId: string, limit = 50): Promise<Notification[]> {
    const { data, error } = await this.sb
      .table('notifications')
      .select('*, actor:tb_members!actor_id(*)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as Notification[];
  }

  async unreadCount(memberId: string): Promise<number> {
    const { count, error } = await this.sb
      .table('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  }

  /** Create a notification (skips self-notifications). */
  async create(opts: {
    memberId: string;
    actorId?: string | null;
    type: string;
    boardId?: string | null;
    cardId?: string | null;
    data?: Record<string, any>;
  }): Promise<void> {
    if (opts.actorId && opts.actorId === opts.memberId) return;
    const { error } = await this.sb.table('notifications').insert({
      member_id: opts.memberId,
      actor_id: opts.actorId ?? null,
      type: opts.type,
      board_id: opts.boardId ?? null,
      card_id: opts.cardId ?? null,
      data: opts.data ?? {},
    });
    if (error) throw error;
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.sb.table('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  }

  async markAllRead(memberId: string): Promise<void> {
    const { error } = await this.sb
      .table('notifications')
      .update({ read: true })
      .eq('member_id', memberId)
      .eq('read', false);
    if (error) throw error;
  }

  /** Realtime: notify when rows for this member change. */
  subscribe(memberId: string, onChange: () => void): RealtimeChannel {
    const channel = this.sb.client.channel(`notif-${memberId}`);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tb_notifications', filter: `member_id=eq.${memberId}` },
      () => onChange(),
    );
    channel.subscribe();
    return channel;
  }

  unsubscribe(channel: RealtimeChannel) {
    this.sb.client.removeChannel(channel);
  }
}
