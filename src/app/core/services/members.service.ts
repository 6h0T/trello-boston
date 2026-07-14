import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Member } from '../models/models';

@Injectable({ providedIn: 'root' })
export class MembersService {
  private sb = inject(SupabaseService);

  async list(): Promise<Member[]> {
    const { data, error } = await this.sb.table('members').select('*').order('name');
    if (error) throw error;
    return data as Member[];
  }

  async create(name: string, email: string | null, color: string): Promise<Member> {
    const { data, error } = await this.sb
      .table('members')
      .insert({ name, email, color })
      .select()
      .single();
    if (error) throw error;
    return data as Member;
  }
}
