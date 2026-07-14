import { Injectable, computed, signal } from '@angular/core';
import { Member } from './models/models';

/**
 * Holds the authenticated user's profile (set by AuthService from the Supabase
 * session) plus the roster of all member profiles (used for card assignment).
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly _members = signal<Member[]>([]);
  private readonly _current = signal<Member | null>(null);

  readonly members = this._members.asReadonly();
  readonly current = this._current.asReadonly();
  readonly currentId = computed<string | null>(() => this._current()?.id ?? null);
  readonly isReady = computed(() => this._current() != null);

  setMembers(members: Member[]) {
    this._members.set(members);
  }

  /** Set the logged-in profile (and make sure it's in the roster). */
  setCurrentMember(member: Member | null) {
    this._current.set(member);
    if (member && !this._members().some((m) => m.id === member.id)) {
      this._members.update((list) => [...list, member]);
    }
  }
}
