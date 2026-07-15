# Roles admin/empleado y visibilidad por membresía — Diseño

**Fecha:** 2026-07-15
**Proyecto:** trello-boston (Boston Boards) — Angular + Supabase (proyecto real: `vknbcuomqzizjdlaeyew`, MCP `supabase-trello`)

## Objetivo

1. Rol global por cuenta: `admin` o `empleado`. Admins: admin@bostonam.com y soledadc@bostonam.com; el resto empleados.
2. Restringir la visualización y edición del contenido de cada tablero a sus miembros. Un admin ve y edita todo.

## Decisiones (aprobadas por el usuario)

- **Admin = acceso total:** ve/edita todos los tableros aunque no sea miembro, gestiona miembros de cualquier tablero y cambia roles de usuarios desde la app.
- **Empleado:** solo ve tableros donde es miembro (o que creó). Puede crear tableros nuevos y queda como owner.
- **Enforcement:** RLS real en Supabase + UI. El filtrado no depende del frontend.
- **Almacenamiento del rol:** columna `role` en `tb_members` (perfil ya es 1:1 con `auth.uid()`). Se descartaron custom claims JWT (requiere re-login y service-role) y tabla de roles aparte (sobredimensionado).

## Base de datos (migración `005_roles_and_rls.sql`)

### Columna de rol

```sql
alter table tb_members add column role text not null default 'empleado'
  check (role in ('admin','empleado'));
update tb_members set role = 'admin'
  where email in ('admin@bostonam.com','soledadc@bostonam.com');
```

### Funciones helper (SECURITY DEFINER, evitan recursión RLS)

- `is_admin()` → `tb_members.role = 'admin'` para `auth.uid()`.
- `can_access_board(bid uuid)` → `is_admin()` OR existe fila en `tb_board_members` OR `tb_boards.created_by = auth.uid()`.
- `can_access_card(cid uuid)` → `can_access_board` del tablero de la tarjeta.

### Protección del rol

Trigger `BEFORE UPDATE` en `tb_members`: si `NEW.role <> OLD.role` y no `is_admin()`, aborta. Un empleado no puede autopromoverse ni vía API directa.

### Políticas RLS (reemplazan las `USING (true)` actuales, solo rol `authenticated`)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tb_members` | autenticados (roster para asignaciones/menciones) | `id = auth.uid()` | `id = auth.uid()` o admin | admin |
| `tb_boards` | `can_access_board(id)` | `created_by = auth.uid()` | `can_access_board(id)` | `can_access_board(id)` |
| `tb_board_members` | `can_access_board(board_id)` | `can_access_board(board_id)` | `can_access_board(board_id)` | `can_access_board(board_id)` |
| `tb_lists`, `tb_labels`, `tb_activity` | `can_access_board(board_id)` en todo | — | — | — |
| `tb_cards` | `can_access_board(board_id)` en todo (tiene `board_id` directo) | — | — | — |
| `tb_card_labels`, `tb_card_members`, `tb_checklists`, `tb_comments`, `tb_attachments` | `can_access_card(card_id)` en todo | — | — | — |
| `tb_checklist_items` | vía checklist → card (`can_access_card`) | — | — | — |
| `tb_notifications` | `recipient_id = auth.uid()` | `actor_id = auth.uid()` | `recipient_id = auth.uid()` | `recipient_id = auth.uid()` |

Notas:
- El creador de un tablero puede auto-agregarse a `tb_board_members` porque `can_access_board` cubre `created_by`.
- Cualquier miembro del tablero gestiona la membresía (comportamiento actual de la app); el admin también.
- Realtime respeta RLS: los suscriptores solo reciben filas que pueden SELECT.
- Verificar nombres reales de columnas de `tb_notifications`/`tb_checklist_items` al escribir la migración.

## Frontend (Angular)

1. **Modelo:** `role: 'admin' | 'empleado'` en `Member`.
2. **`CurrentUserStore`:** computed `isAdmin`.
3. **Home de tableros:** sin cambios de lógica — RLS ya filtra lo que devuelve `BoardsService.list()`.
4. **Panel "Usuarios" (solo admin):** accesible desde el menú del usuario; lista los miembros con selector admin/empleado (`MembersService.updateRole`). Bloquea quitarse el propio admin. Oculto para empleados (y aunque lo forzaran, RLS/trigger lo impide).
5. **Alta de perfil (`ensureProfile`):** compatible — INSERT con `id = auth.uid()` sigue permitido; el borrado de perfiles legacy solo funcionará para admins (los 3 usuarios actuales ya tienen perfil, no afecta).

## Fuera de alcance

- Políticas del bucket de Storage: los adjuntos siguen accesibles por URL. Cerrar el bucket sería un cambio aparte.
- Roles por tablero más granulares (owner/member ya existe en `tb_board_members` y no se toca).

## Verificación

- `npm test` y `npm run build`.
- Prueba manual: vicented (empleado) no ve tableros donde no es miembro; admin y soledadc ven todo; empleado no puede cambiar su rol vía SQL con su sesión.
- Commit + push (deploy Vercel) según workflow del proyecto.
