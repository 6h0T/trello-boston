import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';

const BUCKET = 'tb-media';

/**
 * Uploads media (pasted/attached images & videos) to the public Supabase
 * Storage bucket and returns a public URL.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private sb = inject(SupabaseService);

  private safeName(name: string): string {
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    const base = (dot >= 0 ? name.slice(0, dot) : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'file';
    const rand = Math.floor(performance.now() * 1000) % 1_000_000;
    return `${base}-${rand}${ext}`;
  }

  /** Upload a File/Blob, returns its public URL. */
  async upload(file: File | Blob, suggestedName = 'paste.png', folder = 'cards'): Promise<string> {
    const name = this.safeName(file instanceof File ? file.name : suggestedName);
    const path = `${folder}/${name}`;
    const { error } = await this.sb.client.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: (file as File).type || undefined });
    if (error) throw error;
    const { data } = this.sb.client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}
