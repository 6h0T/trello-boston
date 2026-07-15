# Supabase — Tablas y configuración (trello-boston)

Todo lo necesario para crear / recrear el backend de **Boston Boards** en Supabase.

---

## 1. Proyecto y credenciales

| Dato | Valor |
|------|-------|
| **Project URL** | `https://irdzqnwkxjlinufbtggx.supabase.co` |
| **Publishable key** (frontend) | `sb_publishable_uZedCbwRdfz3hsarPYxf9Q_e-HzgCmj` |
| **Prefijo de tablas** | `tb_` (para no colisionar con tablas existentes del proyecto) |

La key *publishable* (rol `anon`) es **segura para exponer en el frontend**. Está configurada en:

```
src/environments/environment.ts
```

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://irdzqnwkxjlinufbtggx.supabase.co',
  supabaseKey: 'sb_publishable_uZedCbwRdfz3hsarPYxf9Q_e-HzgCmj',
  tablePrefix: 'tb_',
};
```

> Para apuntar a **otro** proyecto Supabase: cambia `supabaseUrl` y `supabaseKey`, y ejecuta los scripts SQL de abajo en ese proyecto.

---

## 2. Cómo crear las tablas

Tienes dos caminos:

### Opción A — Supabase Studio (recomendado, manual)
1. Entra a tu proyecto → **SQL Editor** → **New query**.
2. Pega y ejecuta **`docs/migrations/001_schema.sql`** (tablas, índices y RLS).
3. Pega y ejecuta **`docs/migrations/002_seed_and_realtime.sql`** (Realtime + datos de ejemplo).
4. Pega y ejecuta **`docs/migrations/005_roles_and_rls.sql`** (roles admin/empleado + RLS por membresía de tablero).
5. Pega y ejecuta **`docs/migrations/006_card_notifications.sql`** (triggers de notificaciones por actividad en tarjetas).

### Opción B — Supabase CLI
```bash
supabase link --project-ref irdzqnwkxjlinufbtggx
supabase db push           # si usas la carpeta de migraciones del CLI
# o directamente:
psql "$DATABASE_URL" -f docs/migrations/001_schema.sql
psql "$DATABASE_URL" -f docs/migrations/002_seed_and_realtime.sql
psql "$DATABASE_URL" -f docs/migrations/005_roles_and_rls.sql
psql "$DATABASE_URL" -f docs/migrations/006_card_notifications.sql
```

> En este repo las tablas **ya fueron creadas** vía el MCP de Supabase. Estos scripts sirven para recrearlas en un proyecto limpio o documentar el esquema.

---

## 3. Modelo de datos

```
tb_members ───< tb_board_members >─── tb_boards
                                          │
                                          ├──< tb_lists ──< tb_cards
                                          │                   ├──< tb_card_labels >── tb_labels
                                          │                   ├──< tb_card_members >── tb_members
                                          │                   ├──< tb_checklists ──< tb_checklist_items
                                          │                   ├──< tb_comments
                                          │                   └──< tb_attachments
                                          ├──< tb_labels
                                          └──< tb_activity
```

| Tabla | Descripción | Claves foráneas (ON DELETE) |
|-------|-------------|------------------------------|
| `tb_members` | Usuarios mock (selector sin password) | — |
| `tb_boards` | Tableros | `created_by → tb_members (set null)` |
| `tb_board_members` | Membresía tablero↔usuario (PK compuesta) | `board (cascade)`, `member (cascade)` |
| `tb_lists` | Columnas; `position` para orden | `board (cascade)` |
| `tb_cards` | Tarjetas; `position`, `due_date`, `due_complete`, `cover_color`, `archived` | `list (cascade)`, `board (cascade)` |
| `tb_labels` | Etiquetas de color por tablero | `board (cascade)` |
| `tb_card_labels` | Tarjeta↔etiqueta (PK compuesta) | `card (cascade)`, `label (cascade)` |
| `tb_card_members` | Asignación tarjeta↔usuario (PK compuesta) | `card (cascade)`, `member (cascade)` |
| `tb_checklists` | Checklists de una tarjeta | `card (cascade)` |
| `tb_checklist_items` | Ítems con `done` | `checklist (cascade)` |
| `tb_comments` | Comentarios | `card (cascade)`, `member (set null)` |
| `tb_attachments` | Adjuntos (nombre + url) | `card (cascade)` |
| `tb_activity` | Log de actividad (`type`, `data jsonb`) | `board (cascade)`, `card (set null)`, `member (set null)` |

**Orden (drag & drop):** las columnas y tarjetas se ordenan por el campo `position` (double precision). Al mover un elemento entre dos vecinos se le asigna el promedio de sus posiciones, evitando renumerar toda la lista.

---

## 4. Row Level Security (RLS)

La app usa la key **publishable** (rol `anon`) y autenticación *mock* (selector de usuario, sin login real). Por eso **todas** las tablas tienen RLS habilitado con una política permisiva:

```sql
create policy tb_<tabla>_all on public.tb_<tabla>
  for all to anon, authenticated
  using (true) with check (true);
```

> ⚠️ Esto es apropiado para una **demo multiusuario**. Para producción real se reemplazaría por políticas basadas en `auth.uid()` + Supabase Auth, restringiendo por membresía de tablero.

---

## 5. Realtime

`002_seed_and_realtime.sql` agrega estas tablas a la publicación `supabase_realtime`:

`tb_boards, tb_lists, tb_cards, tb_card_members, tb_card_labels, tb_checklists, tb_checklist_items, tb_comments, tb_activity, tb_labels`

El cliente (`src/app/core/services/realtime.service.ts`) se suscribe a los cambios del tablero abierto y refresca el estado automáticamente, de modo que **varios usuarios ven los cambios en vivo**.

---

## 6. Datos de ejemplo (seed)

`002_seed_and_realtime.sql` es **idempotente** (no inserta si ya hay miembros). Crea:

- **5 miembros:** Ana Ríos, Leo Méndez, Sofía Vera, Diego Paz, Caro Luna.
- **1 tablero:** "Boston AM — Roadmap" (destacado, fondo navy) con los 5 miembros.
- **4 listas:** Backlog, To Do, En progreso, Hecho.
- **6 tarjetas** con etiquetas, asignados, una checklist, un comentario y una entrada de actividad.

Para **reiniciar** los datos de ejemplo:
```sql
truncate table public.tb_members cascade;   -- borra todo (cascade) y permite re-seed
-- luego re-ejecuta el bloque de seed de 002_seed_and_realtime.sql
```

---

## 7. Acceso desde el código

```ts
// src/app/core/supabase.service.ts
this.sb.table('cards')          // → from('tb_cards')  (prefijo automático)
```

Cada dominio tiene su servicio en `src/app/core/services/`:
`boards`, `lists`, `cards`, `labels`, `checklists`, `comments`, `members`, `activity`, `realtime`.

---

## 8. Troubleshooting — error `PGRST205 "Could not find the table in the schema cache"`

PostgREST (la REST API que usa `supabase-js`) mantiene una **caché del esquema**. Tras crear tablas por SQL, hay que **recargarla**. Si ves `PGRST205`:

**Opción 1 — Recargar la caché (lo más rápido):**
En el **SQL Editor del dashboard de Supabase** (conexión directa, no el pooler) ejecuta:
```sql
notify pgrst, 'reload schema';
```
> ⚠️ Importante: ejecútalo desde el **SQL Editor web**, no por el pooler/MCP. En modo *transaction pooling* (pgbouncer) los `NOTIFY` se descartan y la recarga **no** ocurre.

**Opción 2 — Reiniciar el proyecto:**
Dashboard → **Project Settings → General → Restart project** (o pausar/reanudar). Esto reconstruye la caché de PostgREST de forma garantizada.

**Verificar privilegios (ya aplicados en este repo):** las tablas deben tener `GRANT` para los roles del API; ver `docs/migrations/003_grant_api_roles.sql`. Sin grants, PostgREST oculta la tabla del cache aunque exista.

Tras recargar, valida todo con:
```bash
node scripts/smoke-supabase.mjs
```
