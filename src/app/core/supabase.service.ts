import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/** localStorage key where supabase-js persists the session. */
export const AUTH_STORAGE_KEY = 'tb-auth';

/**
 * Thin wrapper around the Supabase client.
 * `table(name)` automatically applies the tb_ prefix so feature code
 * just asks for 'boards', 'cards', etc.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }

  /** Returns a query builder for the prefixed table. */
  table(name: string) {
    return this.client.from(environment.tablePrefix + name);
  }

  fullTableName(name: string): string {
    return environment.tablePrefix + name;
  }
}
