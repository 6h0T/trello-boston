import { Injectable, computed, inject, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { CurrentUserStore } from './current-user.store';
import { MembersService } from './services/members.service';
import { Member, LABEL_COLORS } from './models/models';

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}

/**
 * Supabase Auth wrapper. Profiles live in tb_members keyed by the auth user id,
 * so signing up creates a profile automatically. The board data (created_by,
 * board/card members, etc.) keeps referencing these same member ids.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService);
  private store = inject(CurrentUserStore);
  private membersSvc = inject(MembersService);

  readonly session = signal<Session | null>(null);
  readonly isAuthenticated = computed(() => this.session() != null);

  /** Called once at startup (APP_INITIALIZER) to restore an existing session. */
  async init(): Promise<void> {
    const { data } = await this.sb.client.auth.getSession();
    await this.applySession(data.session);
    this.sb.client.auth.onAuthStateChange((_event, session) => {
      void this.applySession(session);
    });
  }

  private async applySession(session: Session | null): Promise<void> {
    this.session.set(session);
    if (session?.user) {
      try {
        const member = await this.ensureProfile(session.user);
        this.store.setCurrentMember(member);
        await this.loadRoster();
      } catch {
        /* profile sync failure shouldn't crash the app */
      }
    } else {
      this.store.setCurrentMember(null);
    }
  }

  private async loadRoster(): Promise<void> {
    try {
      this.store.setMembers(await this.membersSvc.list());
    } catch {
      /* ignore */
    }
  }

  /** Fetch or create the tb_members profile for an auth user. */
  private async ensureProfile(user: User): Promise<Member> {
    const existing = await this.sb
      .table('members')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (existing.data) return existing.data as Member;

    const name =
      (user.user_metadata?.['name'] as string) ||
      user.email?.split('@')[0] ||
      'Usuario';
    const email = user.email ?? null;

    // Claim a legacy seed profile with the same email (created before auth).
    if (email) {
      const legacy = await this.sb.table('members').select('id').eq('email', email).maybeSingle();
      if (legacy.data && (legacy.data as any).id !== user.id) {
        await this.sb.table('members').delete().eq('id', (legacy.data as any).id);
      }
    }

    const { data, error } = await this.sb
      .table('members')
      .insert({ id: user.id, name, email, color: colorFor(user.id) })
      .select()
      .single();
    if (error) throw error;
    return data as Member;
  }

  async signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await this.sb.client.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (data.session) {
      await this.applySession(data.session);
      return { needsConfirmation: false };
    }
    // No session => email confirmation is enabled on the project.
    return { needsConfirmation: true };
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.sb.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.applySession(data.session);
  }

  async signOut(): Promise<void> {
    await this.sb.client.auth.signOut();
    await this.applySession(null);
  }
}
