/** Client-side ceiling for pasted/attached files (spec 2026-07-23). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ATTACHMENT_EXTENSIONS = ['.zip', '.psd', '.ai', '.rar', '.mp4', '.pdf', '.docx', '.xlsx', '.csv'];

export const ATTACHMENT_ACCEPT = `image/*,video/*,${ATTACHMENT_EXTENSIONS.join(',')}`;

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

export interface CommentPart {
  type: 'text' | 'image' | 'video' | 'file';
  value: string;
  name?: string;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function exceedsUploadLimit(file: { size: number }): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export function isAllowedAttachment(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true;
  return ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name));
}

export function attachmentTypeFor(file: { name: string; type: string }): 'image' | 'video' | 'file' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return 'file';
}

/** Serialize an uploaded comment file as a markdown-style marker. */
export function commentMarker(name: string, url: string, isImage: boolean): string {
  const safe = name.replace(/[\[\]]/g, '') || 'archivo';
  return isImage ? `![${safe}](${url})` : `[${safe}](${url})`;
}

/** Split a comment body into text / image / video / file parts. */
export function parseCommentBody(body: string): CommentPart[] {
  const parts: CommentPart[] = [];
  const re = /(!?)\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const text = body.slice(last, m.index).trim();
    if (text) parts.push({ type: 'text', value: text });
    const [, bang, name, url] = m;
    const type = bang ? 'image' : VIDEO_EXTENSIONS.includes(extensionOf(url)) ? 'video' : 'file';
    parts.push({ type, value: url, name: name || 'archivo' });
    last = m.index + m[0].length;
  }
  const tail = body.slice(last).trim();
  if (tail) parts.push({ type: 'text', value: tail });
  if (!parts.length) parts.push({ type: 'text', value: body });
  return parts;
}

/** Public Supabase URL that forces Content-Disposition: attachment. */
export function downloadUrl(url: string, name: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}download=${encodeURIComponent(name)}`;
}
