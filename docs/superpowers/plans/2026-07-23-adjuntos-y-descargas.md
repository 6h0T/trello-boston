# Descarga de archivos pegados + nuevos tipos de adjuntos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pegar cualquier archivo (≤ 5 MB) en comentarios con descarga (hover + lightbox), y permitir `.zip .psd .ai .rar .mp4 .pdf .docx .xlsx .csv` (≤ 5 MB) en el apartado de adjuntos.

**Architecture:** La lógica pura (límite de tamaño, lista blanca de extensiones, clasificación de tipo, marcadores de comentario, URL de descarga) va a un util nuevo `uploads.ts` con tests (patrón de `mentions.ts`). `card-detail.component.ts` consume el util: paste de comentarios acepta cualquier archivo, el cuerpo serializa `![nombre](url)` / `[nombre](url)`, el render clasifica imagen/video/archivo y añade botones de descarga + lightbox. Sin cambios de BD ni de bucket.

**Tech Stack:** Angular 19 standalone + signals, Supabase Storage (bucket `tb-media`), Karma/Jasmine (`npm test`).

## Global Constraints

- Límite: **5 MB** por archivo en paste de comentarios y en adjuntos (solo cliente).
- Extensiones de adjuntos: `image/*`, `video/*` y `.zip .psd .ai .rar .mp4 .pdf .docx .xlsx .csv`.
- Descarga: URL pública + `?download=<nombre>` (Supabase fuerza `Content-Disposition: attachment`).
- Mensajes de UI en español. Commits en español (estilo del repo, sin prefijos `feat:`).
- Al final: `npm test` + `npm run build` en verde antes del push.

---

### Task 1: Util `uploads.ts` con validaciones, marcadores y parser

**Files:**
- Create: `src/app/core/util/uploads.ts`
- Test: `src/app/core/util/uploads.spec.ts`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces (usadas por Tasks 2-4):
  - `MAX_UPLOAD_BYTES: number` (5 * 1024 * 1024)
  - `ATTACHMENT_ACCEPT: string` (valor para el atributo `accept`)
  - `exceedsUploadLimit(file: { size: number }): boolean`
  - `isAllowedAttachment(file: { name: string; type: string }): boolean`
  - `attachmentTypeFor(file: { name: string; type: string }): 'image' | 'video' | 'file'`
  - `commentMarker(name: string, url: string, isImage: boolean): string`
  - `parseCommentBody(body: string): CommentPart[]` con `CommentPart = { type: 'text' | 'image' | 'video' | 'file'; value: string; name?: string }`
  - `downloadUrl(url: string, name: string): string`

- [ ] **Step 1: Escribir los tests (fallan)**

```ts
// src/app/core/util/uploads.spec.ts
import {
  ATTACHMENT_ACCEPT,
  MAX_UPLOAD_BYTES,
  attachmentTypeFor,
  commentMarker,
  downloadUrl,
  exceedsUploadLimit,
  isAllowedAttachment,
  parseCommentBody,
} from './uploads';

describe('uploads util', () => {
  it('exceedsUploadLimit: 5 MB exactos pasa, un byte más no', () => {
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES })).toBeFalse();
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES + 1 })).toBeTrue();
  });

  it('isAllowedAttachment acepta imagen/video por MIME y documentos por extensión', () => {
    expect(isAllowedAttachment({ name: 'foto.png', type: 'image/png' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'clip.mp4', type: 'video/mp4' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'doc.PDF', type: 'application/pdf' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.zip', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.rar', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.psd', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.ai', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.docx', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.xlsx', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.csv', type: 'text/csv' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'virus.exe', type: 'application/x-msdownload' })).toBeFalse();
    expect(isAllowedAttachment({ name: 'sinextension', type: '' })).toBeFalse();
  });

  it('ATTACHMENT_ACCEPT incluye MIME genéricos y las extensiones', () => {
    expect(ATTACHMENT_ACCEPT).toContain('image/*');
    expect(ATTACHMENT_ACCEPT).toContain('video/*');
    expect(ATTACHMENT_ACCEPT).toContain('.zip');
    expect(ATTACHMENT_ACCEPT).toContain('.docx');
  });

  it('attachmentTypeFor clasifica video, imagen y archivo', () => {
    expect(attachmentTypeFor({ name: 'v.mp4', type: 'video/mp4' })).toBe('video');
    expect(attachmentTypeFor({ name: 'f.png', type: 'image/png' })).toBe('image');
    expect(attachmentTypeFor({ name: 'd.pdf', type: 'application/pdf' })).toBe('file');
  });

  it('commentMarker genera ![..](..) para imágenes y [..](..) para el resto', () => {
    expect(commentMarker('foto.png', 'https://x/a.png', true)).toBe('![foto.png](https://x/a.png)');
    expect(commentMarker('doc.pdf', 'https://x/a.pdf', false)).toBe('[doc.pdf](https://x/a.pdf)');
    expect(commentMarker('ra[ro].pdf', 'https://x/a.pdf', false)).toBe('[raro.pdf](https://x/a.pdf)');
  });

  it('parseCommentBody separa texto, imágenes, videos y archivos', () => {
    const body = 'hola\n![foto.png](https://x/f.png)\n[clip.mp4](https://x/c.mp4)\n[doc.pdf](https://x/d.pdf)\nchau';
    expect(parseCommentBody(body)).toEqual([
      { type: 'text', value: 'hola' },
      { type: 'image', value: 'https://x/f.png', name: 'foto.png' },
      { type: 'video', value: 'https://x/c.mp4', name: 'clip.mp4' },
      { type: 'file', value: 'https://x/d.pdf', name: 'doc.pdf' },
      { type: 'text', value: 'chau' },
    ]);
  });

  it('parseCommentBody mantiene compatibilidad con comentarios antiguos y texto plano', () => {
    expect(parseCommentBody('![imagen](https://x/a.png)')).toEqual([
      { type: 'image', value: 'https://x/a.png', name: 'imagen' },
    ]);
    expect(parseCommentBody('solo texto')).toEqual([{ type: 'text', value: 'solo texto' }]);
  });

  it('downloadUrl añade ?download= con el nombre codificado', () => {
    expect(downloadUrl('https://x/a.pdf', 'mi doc.pdf')).toBe('https://x/a.pdf?download=mi%20doc.pdf');
    expect(downloadUrl('https://x/a.pdf?v=1', 'a.pdf')).toBe('https://x/a.pdf?v=1&download=a.pdf');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test`
Expected: FAIL (módulo `./uploads` no existe).

- [ ] **Step 3: Implementar el util**

```ts
// src/app/core/util/uploads.ts

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
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS (todos los specs, incluidos los preexistentes).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/util/uploads.ts src/app/core/util/uploads.spec.ts
git commit -m "Util de subidas: limite 5MB, tipos de adjunto, marcadores y URL de descarga"
```

---

### Task 2: Icono `download` + paste de cualquier archivo en comentarios

**Files:**
- Modify: `src/app/shared/ui/icon.component.ts` (mapa `PATHS`)
- Modify: `src/app/features/card-detail/card-detail.component.ts` (imports, signals `pendingCommentFiles`/`uploadingCommentFile`, `onCommentPaste`, `addComment`, plantilla del compositor líneas ~423-459)

**Interfaces:**
- Consumes (Task 1): `exceedsUploadLimit`, `commentMarker`.
- Produces: signal `pendingCommentFiles: { name: string; url: string; isImage: boolean }[]`, método `removePendingCommentFile(url: string)`, icono `download` disponible para Tasks 3-4.

- [ ] **Step 1: Añadir el icono `download` al catálogo**

En `icon.component.ts`, tras la entrada `'arrow-up-down'`:

```ts
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
```

- [ ] **Step 2: Reemplazar los signals y el handler de paste**

En `card-detail.component.ts`, sustituir `pendingCommentImages`/`uploadingCommentImage` (líneas 998-1036) por:

```ts
  /** Uploaded-but-unsent files pasted into the comment composer. */
  readonly pendingCommentFiles = signal<{ name: string; url: string; isImage: boolean }[]>([]);
  readonly uploadingCommentFile = signal(false);

  /**
   * Paste handler for the comment textarea: files from the clipboard are
   * uploaded to Storage and queued as pending attachments; plain text pastes
   * fall through to the default behaviour.
   */
  async onCommentPaste(ev: ClipboardEvent) {
    const items = ev.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (!files.length) return; // let text paste happen normally

    ev.preventDefault();
    this.uploadingCommentFile.set(true);
    try {
      for (const file of files) {
        const name = file.name || 'archivo';
        if (exceedsUploadLimit(file)) {
          this.toast.error(`"${name}" supera el límite de 5 MB`);
          continue;
        }
        const url = await this.storageSvc.upload(file, name, 'comments');
        this.pendingCommentFiles.update((list) => [
          ...list,
          { name, url, isImage: file.type.startsWith('image/') },
        ]);
      }
    } catch {
      this.toast.error('No se pudo subir el archivo pegado');
    } finally {
      this.uploadingCommentFile.set(false);
    }
  }

  removePendingCommentFile(url: string) {
    this.pendingCommentFiles.update((list) => list.filter((f) => f.url !== url));
  }
```

Añadir al import de utils existente (junto a `extractMentions`):

```ts
import { commentMarker, downloadUrl, exceedsUploadLimit, parseCommentBody, type CommentPart } from '../../core/util/uploads';
```

(`downloadUrl`, `parseCommentBody` y `CommentPart` se usan en Task 3; importarlos ya evita retocar el import.)

- [ ] **Step 3: Serializar con `commentMarker` en `addComment`**

Sustituir (líneas ~1057-1061):

```ts
    const text = this.commentDraft.trim();
    const files = this.pendingCommentFiles();
    if (!text && !files.length) return;
    const markers = files.map((f) => commentMarker(f.name, f.url, f.isImage)).join('\n');
    const body = [text, markers].filter(Boolean).join('\n');
```

y más abajo `this.pendingCommentImages.set([])` → `this.pendingCommentFiles.set([])`.

- [ ] **Step 4: Actualizar la plantilla del compositor**

Sustituir el bloque de miniaturas pendientes (líneas ~423-445) por:

```html
                    @if (pendingCommentFiles().length || uploadingCommentFile()) {
                      <div class="mt-1.5 flex flex-wrap items-center gap-2">
                        @for (f of pendingCommentFiles(); track f.url) {
                          <div class="relative">
                            @if (f.isImage) {
                              <img
                                [src]="f.url"
                                [alt]="f.name"
                                class="h-16 w-16 rounded-md border border-slate-200 object-cover"
                              />
                            } @else {
                              <span
                                class="flex h-16 max-w-44 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600"
                              >
                                <app-icon name="paperclip" [size]="14" class="shrink-0" />
                                <span class="truncate" [title]="f.name">{{ f.name }}</span>
                              </span>
                            }
                            <button
                              class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-red-600"
                              title="Quitar archivo"
                              (click)="removePendingCommentFile(f.url)"
                            >
                              <app-icon name="x" [size]="10" />
                            </button>
                          </div>
                        }
                        @if (uploadingCommentFile()) {
                          <span class="text-xs text-slate-400">Subiendo archivo…</span>
                        }
                      </div>
                    }
```

Y en el `[disabled]` del botón Enviar (líneas ~450-454): `pendingCommentImages` → `pendingCommentFiles`, `uploadingCommentImage` → `uploadingCommentFile`.

- [ ] **Step 5: Verificar compilación y tests**

Run: `npm test` y `npm run build`
Expected: PASS / build OK (no quedan referencias a `pendingCommentImages` ni `uploadingCommentImage`; verificar con grep).

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/ui/icon.component.ts src/app/features/card-detail/card-detail.component.ts
git commit -m "Pegar cualquier archivo (max 5MB) en comentarios de tarjetas"
```

---

### Task 3: Render de comentarios con descarga + lightbox

**Files:**
- Modify: `src/app/features/card-detail/card-detail.component.ts` (método `commentParts`, plantilla de la lista de comentarios líneas ~476-489, overlay lightbox al final de la plantilla, `HostListener`)

**Interfaces:**
- Consumes (Tasks 1-2): `parseCommentBody`, `downloadUrl`, `CommentPart`, icono `download`.
- Produces: `openLightbox(url: string, name: string)`, `closeLightbox()`, signal `lightbox: { url: string; name: string } | null`, helper `partDownloadUrl(part: CommentPart): string` (plantilla).

- [ ] **Step 1: Delegar el parseo y añadir helpers de lightbox/descarga**

Sustituir `commentParts` (líneas ~1038-1054) por:

```ts
  /** Split a comment body into text / image / video / file parts. */
  commentParts(body: string): CommentPart[] {
    return parseCommentBody(body);
  }

  partDownloadUrl(part: CommentPart): string {
    return downloadUrl(part.value, part.name || 'archivo');
  }

  // ---------- lightbox ----------
  readonly lightbox = signal<{ url: string; name: string } | null>(null);

  openLightbox(url: string, name: string) {
    this.lightbox.set({ url, name });
  }

  closeLightbox() {
    this.lightbox.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeLightbox();
  }

  lightboxDownloadUrl(): string {
    const lb = this.lightbox();
    return lb ? downloadUrl(lb.url, lb.name) : '';
  }
```

Añadir `HostListener` al import de `@angular/core`.

- [ ] **Step 2: Render de partes con hover-descarga**

Sustituir el bloque de partes (líneas ~476-489) por:

```html
                          @for (part of commentParts(cm.body); track $index) {
                            @if (part.type === 'image') {
                              <div class="group/media relative my-1 inline-block">
                                <button type="button" (click)="openLightbox(part.value, part.name || 'imagen')">
                                  <img
                                    [src]="part.value"
                                    [alt]="part.name || 'Imagen adjunta'"
                                    class="max-h-64 max-w-full cursor-zoom-in rounded-md border border-slate-200"
                                    loading="lazy"
                                  />
                                </button>
                                <a
                                  [href]="partDownloadUrl(part)"
                                  class="absolute right-1.5 top-1.5 hidden rounded-md bg-slate-900/70 p-1.5 text-white hover:bg-slate-900 group-hover/media:block"
                                  [title]="'Descargar ' + (part.name || 'imagen')"
                                >
                                  <app-icon name="download" [size]="14" />
                                </a>
                              </div>
                            } @else if (part.type === 'video') {
                              <div class="group/media relative my-1">
                                <video
                                  [src]="part.value"
                                  controls
                                  class="max-h-64 max-w-full rounded-md border border-slate-200 bg-black"
                                ></video>
                                <a
                                  [href]="partDownloadUrl(part)"
                                  class="absolute right-1.5 top-1.5 hidden rounded-md bg-slate-900/70 p-1.5 text-white hover:bg-slate-900 group-hover/media:block"
                                  [title]="'Descargar ' + (part.name || 'video')"
                                >
                                  <app-icon name="download" [size]="14" />
                                </a>
                              </div>
                            } @else if (part.type === 'file') {
                              <a
                                [href]="partDownloadUrl(part)"
                                class="my-1 inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-[#2563eb] hover:bg-slate-100"
                                [title]="'Descargar ' + (part.name || 'archivo')"
                              >
                                <app-icon name="download" [size]="14" class="shrink-0" />
                                <span class="truncate">{{ part.name || 'archivo' }}</span>
                              </a>
                            } @else {
                              <p class="whitespace-pre-wrap break-words text-card-foreground">{{ part.value }}</p>
                            }
                          }
```

- [ ] **Step 3: Overlay del lightbox**

Al final de la plantilla del componente (justo antes del cierre del template raíz):

```html
    @if (lightbox(); as lb) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
        (click)="closeLightbox()"
      >
        <img [src]="lb.url" [alt]="lb.name" class="max-h-full max-w-full rounded-md" (click)="$event.stopPropagation()" />
        <div class="absolute right-4 top-4 flex gap-2" (click)="$event.stopPropagation()">
          <a
            [href]="lightboxDownloadUrl()"
            class="rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            [title]="'Descargar ' + lb.name"
          >
            <app-icon name="download" [size]="18" />
          </a>
          <button class="rounded-md bg-white/10 p-2 text-white hover:bg-white/20" title="Cerrar" (click)="closeLightbox()">
            <app-icon name="x" [size]="18" />
          </button>
        </div>
      </div>
    }
```

- [ ] **Step 4: Verificar**

Run: `npm test` y `npm run build`
Expected: PASS / build OK.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/card-detail/card-detail.component.ts
git commit -m "Descarga y lightbox para archivos pegados en comentarios"
```

---

### Task 4: Adjuntos — nuevos tipos, validación 5 MB y botón de descarga

**Files:**
- Modify: `src/app/features/card-detail/card-detail.component.ts` (input `accept` línea ~289, `onFilesSelected` líneas ~1398-1416, render de adjuntos líneas ~330-363)

**Interfaces:**
- Consumes (Task 1): `ATTACHMENT_ACCEPT`, `isAllowedAttachment`, `exceedsUploadLimit`, `attachmentTypeFor`, `downloadUrl`; icono `download` (Task 2).
- Produces: propiedad de plantilla `attachmentAccept: string`, helper `attachmentDownloadUrl(a: Attachment): string`.

- [ ] **Step 1: Ampliar el `accept` del input**

Añadir la propiedad al componente y ampliar el import de Task 2 con `ATTACHMENT_ACCEPT`, `isAllowedAttachment` y `attachmentTypeFor`:

```ts
  readonly attachmentAccept = ATTACHMENT_ACCEPT;
```

En la plantilla (línea ~289): `accept="image/*,video/*"` → `[accept]="attachmentAccept"`.

- [ ] **Step 2: Validar tipo y tamaño en `onFilesSelected`**

Sustituir el método por:

```ts
  async onFilesSelected(c: Card, ev: Event, input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-selecting the same file
    if (!files.length) return;
    const valid: File[] = [];
    for (const file of files) {
      if (!isAllowedAttachment(file)) {
        this.toast.error(`"${file.name}" no es un tipo de archivo permitido`);
      } else if (exceedsUploadLimit(file)) {
        this.toast.error(`"${file.name}" supera el límite de 5 MB`);
      } else {
        valid.push(file);
      }
    }
    if (!valid.length) return;
    this.uploadingFile.set(true);
    try {
      for (const file of valid) {
        const url = await this.storageSvc.upload(file);
        await this.attachmentsSvc.add(c.id, file.name, url, attachmentTypeFor(file));
      }
      await this.refreshAttachments(c.id);
      this.toast.success(valid.length > 1 ? 'Archivos subidos' : 'Archivo subido');
    } catch (e: any) {
      this.toast.error('No se pudieron subir los archivos');
    } finally {
      this.uploadingFile.set(false);
    }
  }
```

(El tipo `AttachmentType` deja de usarse en este método; quitar el import si queda sin usos.)

- [ ] **Step 3: Render — icono por tipo y botón de descarga**

Añadir el helper:

```ts
  attachmentDownloadUrl(a: Attachment): string {
    return downloadUrl(a.url, a.name);
  }
```

En la plantilla, en la rama `@else` de adjuntos (líneas ~340-350), cambiar el icono `tag` por `download` cuando `a.type === 'file'`:

```html
                        } @else {
                          <a
                            [href]="a.url"
                            target="_blank"
                            rel="noopener"
                            class="flex h-28 w-full flex-col items-center justify-center gap-2 p-2 text-center text-sm text-[#2563eb] hover:bg-slate-100"
                          >
                            <app-icon [name]="a.type === 'file' ? 'download' : 'tag'" [size]="22" />
                            <span class="line-clamp-2 break-all">{{ a.name }}</span>
                          </a>
                        }
```

Y en la fila inferior (líneas ~351-360), añadir el botón de descarga antes de la papelera:

```html
                        <div class="flex items-center justify-between gap-1 px-2 py-1">
                          <span class="truncate text-xs text-slate-600" [title]="a.name">{{ a.name }}</span>
                          <div class="flex shrink-0 items-center">
                            @if (a.type !== 'link') {
                              <a
                                class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#2563eb]"
                                title="Descargar"
                                [href]="attachmentDownloadUrl(a)"
                              >
                                <app-icon name="download" [size]="14" />
                              </a>
                            }
                            <button
                              class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar adjunto"
                              (click)="deleteAttachment(a)"
                            >
                              <app-icon name="trash" [size]="14" />
                            </button>
                          </div>
                        </div>
```

- [ ] **Step 4: Verificar**

Run: `npm test` y `npm run build`
Expected: PASS / build OK.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/card-detail/card-detail.component.ts
git commit -m "Adjuntos: zip, psd, ai, rar, mp4, pdf, docx, xlsx y csv con limite de 5MB y boton de descarga"
```

---

### Task 5: Verificación final y push

- [ ] **Step 1:** `npm test` → todos los specs PASS.
- [ ] **Step 2:** `npm run build` → build de producción OK.
- [ ] **Step 3:** Prueba visual en el dev server: pegar imagen y pdf en un comentario, hover-descarga, lightbox con Escape, adjuntar un `.zip` y un archivo > 5 MB (debe rechazarse con toast).
- [ ] **Step 4:** `git push` (dispara deploy en Vercel).
