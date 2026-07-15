# Notificaciones por actividad en tarjetas asignadas + icono campanita — Diseño

**Fecha:** 2026-07-15
**Proyecto:** trello-boston (Boston Boards) — Angular + Supabase (proyecto `vknbcuomqzizjdlaeyew`, MCP `supabase-trello`)

## Objetivo

1. Cuando un usuario está asignado a una tarjeta (`tb_card_members`), recibir notificación por: comentarios, menciones y cambios relevantes de la tarjeta.
2. Cambiar el icono del menú de notificaciones de `inbox` a una campanita (`bell`).

## Decisiones (aprobadas por el usuario)

- **Cambios relevantes** que notifican: mover de lista, título, descripción, fecha límite y archivado. NO notifican: posición dentro de la misma lista, checklists, etiquetas, adjuntos, portada.
- **Mecanismo:** triggers en Postgres (capturan drag & drop y cualquier ruta de escritura); se descartó instrumentar el frontend (huecos fáciles) y Edge Functions (sobredimensionado).
- Menciones (`card.mentioned`) y asignaciones (`card.assigned`) siguen generándose desde el frontend como hasta ahora.

## Base de datos (migración `006_card_notifications.sql`)

### Helper `notify_card_members`

`notify_card_members(p_card_id uuid, p_actor uuid, p_type text, p_data jsonb)` — SECURITY DEFINER, `search_path=public`:
- Inserta en `tb_notifications` una fila por cada `member_id` de `tb_card_members` de esa tarjeta, excluyendo al actor.
- `board_id` se toma de `tb_cards.board_id`; `data` incluye siempre `title` de la tarjeta.
- **Anti-ruido:** si existe una notificación no leída con mismo `member_id`, `card_id`, `type` y `actor_id` creada hace <5 minutos, actualiza su `data` y `created_at` en lugar de insertar otra.
- EXECUTE revocado de `public`, `anon` y `authenticated` (solo la usan los triggers).

### Triggers

- `tb_comments` AFTER INSERT → `notify_card_members(new.card_id, new.member_id, 'card.commented', {})`.
- `tb_cards` AFTER UPDATE → dispara solo si cambió algo relevante (`IS DISTINCT FROM`):
  - `list_id` cambió → tipo `card.moved`, `data` con `from_list`/`to_list` (títulos de `tb_lists`).
  - `title`, `description`, `due_date` o `archived` cambiaron → tipo `card.updated`, `data.field` con el primer campo cambiado de esa lista (prioridad: archived > due_date > title > description) — un guardado edita normalmente un solo campo.
  - Actor: `auth.uid()` (si es null — cambio hecho por service role — no se notifica a nadie como actor; se usa igualmente para excluir, es decir no se excluye a nadie).

## Frontend

1. **Icono:** añadir `bell` al catálogo de `IconComponent` (SVG estilo feather: campana + badajo) y usarlo en `notifications-menu.component.ts` en el botón del navbar y en el estado vacío.
2. **Textos** en `textFor()` del menú:
   - `card.commented` (ya existe): «{actor} comentó en “{title}”».
   - `card.moved`: «{actor} movió “{title}” a {to_list}».
   - `card.updated` según `data.field`: title → «cambió el título de…», description → «actualizó la descripción de…», due_date → «cambió la fecha límite de…», archived → «archivó…» (o «restauró…» si `data.archived === false`).
3. Sin cambios en servicios ni realtime: el menú ya se refresca por la suscripción existente.

## Compatibilidad con RLS (005)

Los triggers son SECURITY DEFINER: insertan notificaciones para otros usuarios sin pasar por la política `tb_notifications_insert` (que exige `actor_id = auth.uid()` para inserts directos del cliente). La política de lectura (`member_id = auth.uid()`) hace el resto.

## Fuera de alcance

- Notificar checklists/etiquetas/adjuntos/portada.
- Emails o push; solo el panel in-app.
- Preferencias por usuario de qué notificar.

## Verificación

- SQL simulando sesiones: un comentario de admin en una tarjeta con soledadc asignada crea notificación para soledadc y no para admin; mover la tarjeta de lista genera `card.moved`; editar descripción dos veces seguidas no duplica la notificación no leída.
- `npm test` + `npm run build`, prueba visual del icono, commit + push (deploy Vercel).
