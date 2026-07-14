/** Date helpers for due dates (Trello-style short labels, in Spanish). */

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const time = d.getHours() || d.getMinutes()
    ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';
  return sameYear ? day + time : `${day} ${d.getFullYear()}`;
}

export function isOverdue(iso: string | null | undefined, complete = false): boolean {
  if (!iso || complete) return false;
  return new Date(iso).getTime() < Date.now();
}

export function isDueSoon(iso: string | null | undefined, complete = false): boolean {
  if (!iso || complete) return false;
  const d = new Date(iso).getTime();
  const now = Date.now();
  return d >= now && d <= now + 24 * 3600 * 1000;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'hace un momento';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDue(iso);
}

/** For <input type="datetime-local"> binding. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
