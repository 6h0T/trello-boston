import { Injectable, computed, signal } from '@angular/core';
import { Card } from './models/models';

export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none' | 'complete';

/**
 * Board-level filtering state. The filter bar (board-extras) writes here;
 * the board canvas reads `matches()` to decide which cards to show.
 * Provided at the board route (alongside BoardStore).
 */
@Injectable()
export class FilterService {
  readonly query = signal('');
  readonly memberIds = signal<string[]>([]);
  readonly labelIds = signal<string[]>([]);
  readonly due = signal<DueFilter>('any');

  readonly active = computed(
    () =>
      this.query().trim().length > 0 ||
      this.memberIds().length > 0 ||
      this.labelIds().length > 0 ||
      this.due() !== 'any',
  );

  toggleMember(id: string) {
    this.memberIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  toggleLabel(id: string) {
    this.labelIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  clear() {
    this.query.set('');
    this.memberIds.set([]);
    this.labelIds.set([]);
    this.due.set('any');
  }

  matches(card: Card): boolean {
    const q = this.query().trim().toLowerCase();
    if (q) {
      const hay = (card.title + ' ' + (card.description ?? '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const mIds = this.memberIds();
    if (mIds.length) {
      const cardMemberIds = (card.members ?? []).map((m) => m.id);
      if (!mIds.some((id) => cardMemberIds.includes(id))) return false;
    }
    const lIds = this.labelIds();
    if (lIds.length) {
      const cardLabelIds = (card.labels ?? []).map((l) => l.id);
      if (!lIds.some((id) => cardLabelIds.includes(id))) return false;
    }
    const due = this.due();
    if (due !== 'any') {
      if (due === 'complete') return card.due_complete;
      if (due === 'none') return !card.due_date;
      if (!card.due_date) return false;
      const d = new Date(card.due_date).getTime();
      const now = Date.now();
      if (due === 'overdue') return d < now && !card.due_complete;
      if (due === 'today') {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return d <= end.getTime() && d >= now - 86400000;
      }
      if (due === 'week') return d <= now + 7 * 86400000 && d >= now;
    }
    return true;
  }
}
