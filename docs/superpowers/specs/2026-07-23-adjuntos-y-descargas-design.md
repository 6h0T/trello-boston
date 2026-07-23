# Descarga de archivos pegados en comentarios + nuevos tipos de adjuntos — Diseño

**Fecha:** 2026-07-23
**Proyecto:** trello-boston (Boston Boards) — Angular + Supabase (proyecto `vknbcuomqzizjdlaeyew`, MCP `supabase-trello`)

## Objetivo

1. Poder pegar cualquier archivo (imagen, video, zip, pdf…) en el campo de comentarios de la tarjeta y poder descargarlo después.
2. En el apartado de adjuntos, poder subir `.zip .psd .ai .rar .mp4 .pdf .docx .xlsx .csv` además de imágenes y videos.
3. Límite de 5 MB por archivo en ambos flujos (decisión del usuario: mismo límite en todos lados).

## Decisiones (aprobadas por el usuario)

- **Descarga «ambos»:** botón de descarga al hover sobre cada imagen/video/archivo pegado en comentarios, y clic en una imagen abre un visor ampliado (lightbox) con botón de descarga.
- **Límite:** 5 MB por archivo, igual para paste en comentarios y para el apartado de adjuntos. Validación solo en cliente; no se toca la configuración del bucket (afectaría a fondos de tablero, etc.).
- Se conserva el nombre original del archivo pegado (hoy todo se sube como `comment.png`).

## Frontend (todo en `card-detail.component.ts` + `storage.service.ts`)

### 1. Paste en comentarios (`onCommentPaste`)

- Deja de filtrar solo `image/*`: acepta cualquier `kind === 'file'` del portapapeles.
- Archivos > 5 MB se rechazan con mensaje visible («El archivo supera el límite de 5 MB»); el resto se sube a `tb-media/comments` con su nombre original.
- Serialización en el cuerpo del comentario: imágenes siguen como `![nombre](url)`; el resto como `[nombre](url)`.
- Render (`commentParts` + plantilla): además de `text`/`image`, nuevo tipo de parte por extensión de la URL: `.mp4/.webm/.mov` → `<video controls>`; otros → chip con icono, nombre y botón de descarga.

### 2. Descarga

- URL de descarga: URL pública de Supabase + `?download=<nombre>` (fuerza `Content-Disposition: attachment` con el nombre original).
- Botón de descarga al hover sobre imágenes y videos de comentarios (overlay con icono `download`, que se añade al catálogo de `IconComponent` si no existe).
- Lightbox: clic en imagen de comentario abre overlay a pantalla completa en el mismo componente (signal con la URL activa), con botón de descarga y cierre por Escape / clic fuera / botón X.

### 3. Apartado de adjuntos

- `accept` del input: `image/*,video/*,.zip,.psd,.ai,.rar,.mp4,.pdf,.docx,.xlsx,.csv`.
- `onFilesSelected`: valida extensión (lista blanca anterior + imagen/video por MIME) y tamaño ≤ 5 MB; los que no pasan se omiten con mensaje de error y el resto se sube.
- Tipo del adjunto: `video/*` → `video`, `image/*` → `image`, resto → `file` (el modelo `AttachmentType` ya lo soporta).
- Render: documentos como fila con icono + nombre + botón de descarga; a imágenes y videos existentes también se les añade botón de descarga (hover) para consistencia.

## Sin cambios en base de datos ni en el bucket

La tabla `tb_attachments` ya tiene columna `type` con valor `file` soportado, y el bucket `tb-media` se sigue usando tal cual (carpetas `comments` y `cards`).

## Fuera de alcance

- Límite de tamaño en servidor (`file_size_limit` del bucket).
- Paste de archivos en el editor de contenido enriquecido «General» (solo se toca el compositor de comentarios).
- Previsualización de documentos (pdf, office…): solo icono + nombre + descarga.

## Verificación

- Tests de unidad del componente para: rechazo > 5 MB, serialización `[nombre](url)`, clasificación imagen/video/archivo, validación de extensiones en adjuntos.
- `npm test` + `npm run build`, prueba visual (pegar imagen/archivo, hover, lightbox, adjuntar pdf/zip), commit + push (deploy Vercel).
