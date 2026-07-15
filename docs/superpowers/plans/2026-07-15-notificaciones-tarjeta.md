# Notificaciones de actividad en tarjetas + campanita — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los miembros asignados a una tarjeta reciben notificaciones por comentarios y cambios relevantes (mover de lista, título, descripción, fecha límite, archivado), y el menú de notificaciones usa una campanita.

**Architecture:** Triggers Postgres `SECURITY DEFINER` sobre `tb_comments` (INSERT) y `tb_cards` (UPDATE) llaman a un helper `notify_card_members` que inserta en `tb_notifications` para cada asignado (excepto el actor), con dedupe de no-leídas de <5 min. El frontend solo aprende a pintar los tipos nuevos (`card.moved`, `card.updated`) y cambia el icono `inbox` → `bell`.

**Tech Stack:** Angular 20 standalone + signals, Supabase Postgres (proyecto `vknbcuomqzizjdlaeyew`, MCP `supabase-trello`), Karma/Jasmine, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-notificaciones-tarjeta-design.md`.
- Notifican SOLO: comentarios, mover de lista, título, descripción, fecha límite, archivado. NO: posición en la misma lista, checklists, etiquetas, adjuntos, portada.
- Menciones y asignaciones siguen creándose desde el frontend (no tocar).
- Funciones nuevas: EXECUTE revocado de `public`, `anon` y `authenticated` (solo triggers).
- Mensajes de UI y commits en español.
- Tests: `npm test -- --watch=false --browsers=ChromeHeadless`. Build: `npm run build`.
- Al final: push a `main` (deploy Vercel).

---

### Task 1: Migración `006_card_notifications.sql` (helper + triggers)

**Files:**
- Create: `docs/migrations/006_card_notifications.sql`
- Modify: `docs/SUPABASE.md` (añadir la migración a las dos listas de scripts)

**Interfaces:**
- Consumes: `tb_notifications(member_id, actor_id, type, board_id, card_id, data, read)`, `tb_card_members(card_id, member_id)`, `tb_cards(id, board_id, title, list_id, description, due_date, archived)`, `tb_comments(card_id, member_id)`, `tb_lists(id, title)`.
- Produces: tipos de notificación `card.commented`, `card.moved` (`data.from_list`, `data.to_list`), `card.updated` (`data.field` ∈ archived|due_date|title|description, y `data.archived` boolean cuando field=archived). Todos con `data.title` (título de la tarjeta). Task 2 renderiza estos tipos.

- [ ] **Step 1: Escribir la migración**

Contenido completo de `docs/migrations/006_card_notifications.sql`:

```sql
-- 006_card_notifications.sql — Notificar a los miembros asignados a una tarjeta
-- por comentarios y cambios relevantes (mover de lista, título, descripción,
-- fecha límite, archivado). SECURITY DEFINER: los triggers insertan
-- notificaciones para otros usuarios sin pasar por la política de INSERT.

-- Helper: notifica a todos los asignados de la tarjeta excepto el actor.
-- Anti-ruido: si hay una notificación no leída idéntica (<5 min), la refresca.
create or replace function public.notify_card_members(
  p_card_id uuid, p_actor uuid, p_type text, p_data jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_card record;
  r record;
  v_data jsonb;
begin
  select id, board_id, title into v_card from tb_cards where id = p_card_id;
  if v_card.id is null then
    return;
  end if;
  v_data := coalesce(p_data, '{}'::jsonb) || jsonb_build_object('title', v_card.title);
  for r in
    select member_id from tb_card_members
     where card_id = p_card_id
       and (p_actor is null or member_id <> p_actor)
  loop
    update tb_notifications
       set data = v_data, created_at = now()
     where member_id = r.member_id
       and card_id = p_card_id
       and type = p_type
       and actor_id is not distinct from p_actor
       and read = false
       and created_at > now() - interval '5 minutes';
    if not found then
      insert into tb_notifications (member_id, actor_id, type, board_id, card_id, data)
      values (r.member_id, p_actor, p_type, v_card.board_id, p_card_id, v_data);
    end if;
  end loop;
end;
$$;

-- Comentario nuevo → card.commented (el autor es el actor)
create or replace function public.trg_notify_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify_card_members(new.card_id, new.member_id, 'card.commented', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_tb_comments_notify on public.tb_comments;
create trigger trg_tb_comments_notify
  after insert on public.tb_comments
  for each row execute function public.trg_notify_comment();

-- Cambio relevante en la tarjeta → card.moved / card.updated
create or replace function public.trg_notify_card_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from text;
  v_to text;
begin
  if new.list_id is distinct from old.list_id then
    select title into v_from from tb_lists where id = old.list_id;
    select title into v_to from tb_lists where id = new.list_id;
    perform public.notify_card_members(new.id, v_actor, 'card.moved',
      jsonb_build_object('from_list', v_from, 'to_list', v_to));
  end if;
  -- Un guardado normal cambia un solo campo; prioridad si vinieran juntos.
  if new.archived is distinct from old.archived then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'archived', 'archived', new.archived));
  elsif new.due_date is distinct from old.due_date then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'due_date'));
  elsif new.title is distinct from old.title then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'title'));
  elsif new.description is distinct from old.description then
    perform public.notify_card_members(new.id, v_actor, 'card.updated',
      jsonb_build_object('field', 'description'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tb_cards_notify on public.tb_cards;
create trigger trg_tb_cards_notify
  after update on public.tb_cards
  for each row execute function public.trg_notify_card_update();

-- Solo los triggers usan estas funciones; sin acceso vía RPC.
revoke execute on function
  public.notify_card_members(uuid, uuid, text, jsonb),
  public.trg_notify_comment(),
  public.trg_notify_card_update()
from public, anon, authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Con el MCP `supabase-trello`: `apply_migration` con `name: "card_notifications"` y el SQL anterior.

- [ ] **Step 3: Verificar por SQL (simulación de sesiones)**

Datos: admin `d7134804-660c-49c9-bfeb-13d17a862226`, soledadc `1497fde6-6ebb-4e0b-8af3-2af39f152392`. Elegir una tarjeta que tenga a soledadc asignada (o asignarla temporalmente):

```sql
select cm.card_id, c.title from tb_card_members cm join tb_cards c on c.id=cm.card_id
 where cm.member_id='1497fde6-6ebb-4e0b-8af3-2af39f152392' limit 1;
```

Test A — comentario de admin notifica a soledadc y no a admin:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d7134804-660c-49c9-bfeb-13d17a862226","role":"authenticated"}';
insert into tb_comments (card_id, member_id, body) values ('<CARD_ID>', 'd7134804-660c-49c9-bfeb-13d17a862226', 'prueba trigger');
select member_id, type, data from tb_notifications where card_id='<CARD_ID>' and type='card.commented';
rollback;
```

Esperado: 1 fila con `member_id` = soledadc (y ninguna para admin).

Test B — dedupe: dos comentarios seguidos del mismo actor dejan UNA notificación no leída:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d7134804-660c-49c9-bfeb-13d17a862226","role":"authenticated"}';
insert into tb_comments (card_id, member_id, body) values ('<CARD_ID>', 'd7134804-660c-49c9-bfeb-13d17a862226', 'uno');
insert into tb_comments (card_id, member_id, body) values ('<CARD_ID>', 'd7134804-660c-49c9-bfeb-13d17a862226', 'dos');
select count(*) from tb_notifications where card_id='<CARD_ID>' and type='card.commented' and read=false;
rollback;
```

Esperado: `count = 1`.

Test C — mover de lista genera `card.moved` con nombres de lista:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d7134804-660c-49c9-bfeb-13d17a862226","role":"authenticated"}';
update tb_cards set list_id = (select id from tb_lists where board_id = (select board_id from tb_cards where id='<CARD_ID>') and id <> (select list_id from tb_cards where id='<CARD_ID>') limit 1)
 where id='<CARD_ID>';
select member_id, type, data->>'from_list' as f, data->>'to_list' as t from tb_notifications where card_id='<CARD_ID>' and type='card.moved';
rollback;
```

Esperado: 1 fila para soledadc con `f` y `t` con títulos de listas.

Test D — cambio de posición en la misma lista NO notifica:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d7134804-660c-49c9-bfeb-13d17a862226","role":"authenticated"}';
update tb_cards set position = position + 1 where id='<CARD_ID>';
select count(*) from tb_notifications where card_id='<CARD_ID>' and type in ('card.moved','card.updated');
rollback;
```

Esperado: `count = 0`.

- [ ] **Step 4: Actualizar `docs/SUPABASE.md`**

En la lista de la Opción A añadir tras la línea de `005_roles_and_rls.sql`:

```markdown
5. Pega y ejecuta **`docs/migrations/006_card_notifications.sql`** (triggers de notificaciones por actividad en tarjetas).
```

Y en el bloque de la Opción B añadir:

```bash
psql "$DATABASE_URL" -f docs/migrations/006_card_notifications.sql
```

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/006_card_notifications.sql docs/SUPABASE.md
git commit -m "Triggers de notificaciones por actividad en tarjetas asignadas"
```

---

### Task 2: Frontend — textos de los tipos nuevos + icono campanita

**Files:**
- Modify: `src/app/shared/ui/icon.component.ts:8` (añadir `bell` al mapa `PATHS`)
- Modify: `src/app/features/notifications/notifications-menu.component.ts:37,63,113-126` (icono + `textFor`)
- Test: `src/app/features/notifications/notifications-menu.spec.ts` (nuevo)

**Interfaces:**
- Consumes: tipos y `data` de Task 1 (`card.moved` con `from_list`/`to_list`; `card.updated` con `field` y `archived`); `Notification` de `src/app/core/models/models.ts`.
- Produces: textos en español para todos los tipos; icono `bell` disponible en `IconComponent`.

- [ ] **Step 1: Escribir el test que falla**

`src/app/features/notifications/notifications-menu.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { NotificationsMenuComponent } from './notifications-menu.component';
import { Notification } from '../../core/models/models';

const notif = (over: Partial<Notification>): Notification =>
  ({
    id: 'n1',
    member_id: 'm1',
    actor: { id: 'a1', name: 'Ana', color: '#000' },
    type: 'card.commented',
    read: false,
    data: { title: 'Tarea X' },
    ...over,
  }) as Notification;

describe('NotificationsMenuComponent.textFor', () => {
  let component: NotificationsMenuComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotificationsMenuComponent] });
    component = TestBed.createComponent(NotificationsMenuComponent).componentInstance;
  });

  it('describe un movimiento de lista', () => {
    const n = notif({ type: 'card.moved', data: { title: 'Tarea X', from_list: 'Por hacer', to_list: 'Hecho' } });
    expect(component.textFor(n)).toBe('Ana movió «Tarea X» a Hecho');
  });

  it('describe cambios de campo', () => {
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'title' } })))
      .toBe('Ana cambió el título de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'description' } })))
      .toBe('Ana actualizó la descripción de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'due_date' } })))
      .toBe('Ana cambió la fecha límite de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'archived', archived: true } })))
      .toBe('Ana archivó «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'archived', archived: false } })))
      .toBe('Ana restauró «T»');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Esperado: FAIL (textFor devuelve el `type` crudo para los tipos nuevos).

- [ ] **Step 3: Implementar**

En `src/app/shared/ui/icon.component.ts`, añadir al mapa `PATHS` (tras la línea de `users`):

```ts
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
```

En `src/app/features/notifications/notifications-menu.component.ts`:

1. Botón del navbar (línea 37): `<app-icon name="inbox" [size]="18" />` → `<app-icon name="bell" [size]="18" />`
2. Estado vacío (línea 63): `<app-icon name="inbox" [size]="28" />` → `<app-icon name="bell" [size]="28" />`
3. En `textFor`, añadir antes del `default`:

```ts
      case 'card.moved':
        return `${actor} movió «${title}» a ${n.data?.['to_list'] ?? 'otra lista'}`;
      case 'card.updated':
        switch (n.data?.['field']) {
          case 'title':
            return `${actor} cambió el título de «${title}»`;
          case 'description':
            return `${actor} actualizó la descripción de «${title}»`;
          case 'due_date':
            return `${actor} cambió la fecha límite de «${title}»`;
          case 'archived':
            return n.data?.['archived'] === false
              ? `${actor} restauró «${title}»`
              : `${actor} archivó «${title}»`;
          default:
            return `${actor} actualizó «${title}»`;
        }
```

- [ ] **Step 4: Tests + build en verde**

Run: `npm test -- --watch=false --browsers=ChromeHeadless` → PASS
Run: `npm run build` → OK (warning de bundle budget preexistente aceptable).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/icon.component.ts src/app/features/notifications/notifications-menu.component.ts src/app/features/notifications/notifications-menu.spec.ts
git commit -m "Campanita y textos para notificaciones de actividad en tarjetas"
```

---

### Task 3: Verificación end-to-end y push

**Files:**
- Ninguno nuevo.

**Interfaces:**
- Consumes: triggers desplegados (Task 1) + frontend (Task 2).

- [ ] **Step 1: Suite y build completos**

Run: `npm test -- --watch=false --browsers=ChromeHeadless` → PASS
Run: `npm run build` → OK

- [ ] **Step 2: Revisar advisors de seguridad de Supabase**

MCP `supabase-trello`: `get_advisors(type: security)`. Esperado: sin avisos nuevos sobre `notify_card_members`, `trg_notify_comment` ni `trg_notify_card_update` (EXECUTE revocado).

- [ ] **Step 3: Push (deploy Vercel)**

```bash
git push
```

Esperado: push a `main` de 6h0T/trello-boston dispara deploy en Vercel.
