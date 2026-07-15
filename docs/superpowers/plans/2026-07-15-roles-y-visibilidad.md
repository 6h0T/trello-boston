# Roles admin/empleado + visibilidad por membresía — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rol global `admin`/`empleado` por cuenta, con RLS real en Supabase para que cada usuario solo vea los tableros donde es miembro (los admins ven todo) y un panel de administración de roles.

**Architecture:** El rol vive en `tb_members.role` (perfil 1:1 con `auth.uid()`). Funciones SQL `SECURITY DEFINER` (`is_admin`, `can_access_board`, `can_access_card`) alimentan políticas RLS que reemplazan las actuales `USING (true)`. El frontend Angular solo agrega el campo al modelo, un computed `isAdmin` y una página `/usuarios` para admins; el filtrado de tableros lo hace la base de datos.

**Tech Stack:** Angular 20 standalone + signals, Supabase (Postgres RLS, proyecto `vknbcuomqzizjdlaeyew` vía MCP `supabase-trello`), Karma/Jasmine, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-roles-y-visibilidad-design.md`.
- Admins iniciales: `admin@bostonam.com` y `soledadc@bostonam.com`; rol por defecto `empleado`.
- Todas las políticas nuevas aplican al rol `authenticated`; `anon` queda sin acceso.
- Mensajes de UI y de commit en español.
- Tests: `npm test -- --watch=false --browsers=ChromeHeadless`. Build: `npm run build`.
- Workflow del repo: cada tarea termina en commit; al final push (deploy Vercel).
- Migraciones SQL se guardan en `docs/migrations/` y se aplican con el MCP `supabase-trello` (`apply_migration`).

---

### Task 1: Migración SQL — rol, helpers, trigger y políticas RLS

**Files:**
- Create: `docs/migrations/005_roles_and_rls.sql`
- Modify: `docs/SUPABASE.md` (añadir la migración a la lista de scripts)

**Interfaces:**
- Consumes: esquema existente (`tb_members.id = auth.uid()`, `tb_cards.board_id`, `tb_checklist_items.checklist_id`).
- Produces: columna `tb_members.role` (`'admin' | 'empleado'`), funciones `public.is_admin()`, `public.can_access_board(uuid)`, `public.can_access_card(uuid)`; políticas RLS por tabla. El frontend (Tasks 2-3) depende de `tb_members.role`.

- [ ] **Step 1: Escribir la migración**

Contenido completo de `docs/migrations/005_roles_and_rls.sql`:

```sql
-- 005_roles_and_rls.sql — Rol global admin/empleado + RLS por membresía de tablero.
-- Reemplaza las políticas abiertas (USING true) de 001_schema.sql.

-- 1) Rol global en el perfil
alter table public.tb_members
  add column if not exists role text not null default 'empleado'
  check (role in ('admin','empleado'));

update public.tb_members set role = 'admin'
 where email in ('admin@bostonam.com','soledadc@bostonam.com');

-- 2) Helpers SECURITY DEFINER (evitan recursión RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from tb_members where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_board(bid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or exists (select 1 from tb_board_members
                  where board_id = bid and member_id = auth.uid())
      or exists (select 1 from tb_boards
                  where id = bid and created_by = auth.uid());
$$;

create or replace function public.can_access_card(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from tb_cards c
     where c.id = cid and public.can_access_board(c.board_id)
  );
$$;

grant execute on function public.is_admin(), public.can_access_board(uuid), public.can_access_card(uuid) to authenticated;

-- 3) Solo un admin puede cambiar roles (ni siquiera el propio)
create or replace function public.tb_members_protect_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tb_members_protect_role on public.tb_members;
create trigger trg_tb_members_protect_role
  before update on public.tb_members
  for each row execute function public.tb_members_protect_role();

-- 4) Políticas RLS
-- tb_members: roster visible para autenticados (asignaciones y menciones)
drop policy if exists tb_members_all on public.tb_members;
create policy tb_members_select on public.tb_members
  for select to authenticated using (true);
create policy tb_members_insert on public.tb_members
  for insert to authenticated with check (id = auth.uid());
create policy tb_members_update on public.tb_members
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy tb_members_delete on public.tb_members
  for delete to authenticated using (public.is_admin());

-- tb_boards
drop policy if exists tb_boards_all on public.tb_boards;
create policy tb_boards_select on public.tb_boards
  for select to authenticated using (public.can_access_board(id));
create policy tb_boards_insert on public.tb_boards
  for insert to authenticated with check (created_by = auth.uid());
create policy tb_boards_update on public.tb_boards
  for update to authenticated
  using (public.can_access_board(id)) with check (public.can_access_board(id));
create policy tb_boards_delete on public.tb_boards
  for delete to authenticated using (public.can_access_board(id));

-- tb_board_members (el creador entra por created_by en can_access_board)
drop policy if exists tb_board_members_all on public.tb_board_members;
create policy tb_board_members_rw on public.tb_board_members
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Tablas con board_id directo
drop policy if exists tb_lists_all on public.tb_lists;
create policy tb_lists_rw on public.tb_lists
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_labels_all on public.tb_labels;
create policy tb_labels_rw on public.tb_labels
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_activity_all on public.tb_activity;
create policy tb_activity_rw on public.tb_activity
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

drop policy if exists tb_cards_all on public.tb_cards;
create policy tb_cards_rw on public.tb_cards
  for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Tablas hijas de tarjeta (card_id)
drop policy if exists tb_card_labels_all on public.tb_card_labels;
create policy tb_card_labels_rw on public.tb_card_labels
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_card_members_all on public.tb_card_members;
create policy tb_card_members_rw on public.tb_card_members
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_checklists_all on public.tb_checklists;
create policy tb_checklists_rw on public.tb_checklists
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_comments_all on public.tb_comments;
create policy tb_comments_rw on public.tb_comments
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists tb_attachments_all on public.tb_attachments;
create policy tb_attachments_rw on public.tb_attachments
  for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

-- tb_checklist_items: vía checklist → tarjeta
drop policy if exists tb_checklist_items_all on public.tb_checklist_items;
create policy tb_checklist_items_rw on public.tb_checklist_items
  for all to authenticated
  using (exists (select 1 from public.tb_checklists cl
                  where cl.id = checklist_id and public.can_access_card(cl.card_id)))
  with check (exists (select 1 from public.tb_checklists cl
                  where cl.id = checklist_id and public.can_access_card(cl.card_id)));

-- tb_notifications: solo el destinatario las ve/gestiona; cualquiera autenticado
-- puede crear notificaciones actuando como sí mismo (menciones, asignaciones)
drop policy if exists tb_notifications_all on public.tb_notifications;
create policy tb_notifications_select on public.tb_notifications
  for select to authenticated using (member_id = auth.uid());
create policy tb_notifications_insert on public.tb_notifications
  for insert to authenticated with check (actor_id = auth.uid());
create policy tb_notifications_update on public.tb_notifications
  for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy tb_notifications_delete on public.tb_notifications
  for delete to authenticated using (member_id = auth.uid());
```

- [ ] **Step 2: Aplicar la migración**

Con el MCP `supabase-trello`: `apply_migration` con `name: "roles_and_rls"` y el SQL anterior.

- [ ] **Step 3: Verificar roles y políticas**

```sql
select email, role from tb_members order by email;
-- admin@bostonam.com=admin, soledadc@bostonam.com=admin, vicented@bostonam.com=empleado
select tablename, count(*) from pg_policies where schemaname='public' group by tablename order by tablename;
-- ninguna política *_all restante; tb_members y tb_notifications con 4, tb_boards con 4, resto 1 (rw)
```

- [ ] **Step 4: Verificar RLS simulando a un empleado (vicented)**

Ejecutar vía `execute_sql` (en una sola transacción):

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d2b376dc-ab18-4efb-981d-7e953d664780","role":"authenticated"}';
select (select count(*) from tb_boards) as boards_visibles,
       (select count(*) from tb_cards) as cards_visibles;
rollback;
```

Esperado: solo los tableros/tarjetas donde vicented es miembro (comparar con `select board_id from tb_board_members where member_id='d2b376dc-...'`). Repetir con el `sub` de soledadc (`1497fde6-6ebb-4e0b-8af3-2af39f152392`): debe ver TODOS los tableros (2) por ser admin. Probar también que vicented no puede autopromoverse:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"d2b376dc-ab18-4efb-981d-7e953d664780","role":"authenticated"}';
update tb_members set role='admin' where id='d2b376dc-ab18-4efb-981d-7e953d664780';
rollback;
-- Esperado: ERROR "Solo un administrador puede cambiar roles"
```

- [ ] **Step 5: Actualizar `docs/SUPABASE.md`**

Añadir `docs/migrations/005_roles_and_rls.sql` a la lista de scripts (sección "Cómo crear las tablas"), con una línea: roles admin/empleado + RLS por membresía.

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/005_roles_and_rls.sql docs/SUPABASE.md
git commit -m "Roles admin/empleado y RLS por membresia de tablero"
```

---

### Task 2: Frontend — modelo `Member.role`, `isAdmin` y `MembersService.updateRole`

**Files:**
- Modify: `src/app/core/models/models.ts:6-13` (interface `Member`)
- Modify: `src/app/core/current-user.store.ts`
- Modify: `src/app/core/services/members.service.ts`
- Test: `src/app/core/current-user.store.spec.ts` (nuevo)

**Interfaces:**
- Consumes: columna `tb_members.role` (Task 1).
- Produces: `Member.role?: 'admin' | 'empleado'`; `CurrentUserStore.isAdmin: Signal<boolean>`; `CurrentUserStore.updateMember(member: Member): void`; `MembersService.updateRole(id: string, role: 'admin' | 'empleado'): Promise<void>`. Task 3 consume los tres.

- [ ] **Step 1: Escribir el test que falla**

`src/app/core/current-user.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from './current-user.store';
import { Member } from './models/models';

const member = (over: Partial<Member>): Member => ({
  id: 'm1',
  name: 'Test',
  color: '#000',
  ...over,
});

describe('CurrentUserStore', () => {
  let store: CurrentUserStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CurrentUserStore);
  });

  it('isAdmin es false sin usuario o con rol empleado', () => {
    expect(store.isAdmin()).toBeFalse();
    store.setCurrentMember(member({ role: 'empleado' }));
    expect(store.isAdmin()).toBeFalse();
  });

  it('isAdmin es true con rol admin', () => {
    store.setCurrentMember(member({ role: 'admin' }));
    expect(store.isAdmin()).toBeTrue();
  });

  it('updateMember actualiza el roster y el usuario actual', () => {
    store.setCurrentMember(member({ id: 'm1', role: 'empleado' }));
    store.setMembers([member({ id: 'm1', role: 'empleado' }), member({ id: 'm2' })]);
    store.updateMember(member({ id: 'm1', role: 'admin' }));
    expect(store.isAdmin()).toBeTrue();
    expect(store.members().find((m) => m.id === 'm1')?.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Esperado: FAIL (no existen `role` en `Member`, ni `isAdmin`/`updateMember`).

- [ ] **Step 3: Implementación mínima**

En `src/app/core/models/models.ts`, dentro de `interface Member` (tras `color: string;`):

```ts
export type MemberRole = 'admin' | 'empleado';

export interface Member {
  id: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  color: string;
  role?: MemberRole;
  created_at?: string;
}
```

En `src/app/core/current-user.store.ts` añadir a la clase:

```ts
readonly isAdmin = computed(() => this._current()?.role === 'admin');

/** Replace a member in the roster (and the current user if it's them). */
updateMember(member: Member) {
  this._members.update((list) => list.map((m) => (m.id === member.id ? member : m)));
  if (this._current()?.id === member.id) this._current.set(member);
}
```

En `src/app/core/services/members.service.ts` añadir:

```ts
async updateRole(id: string, role: 'admin' | 'empleado'): Promise<void> {
  const { error } = await this.sb.table('members').update({ role }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Ejecutar tests**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Esperado: PASS (todos, incluidos los specs existentes).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/models/models.ts src/app/core/current-user.store.ts src/app/core/services/members.service.ts src/app/core/current-user.store.spec.ts
git commit -m "Modelo de rol de usuario e isAdmin en el store"
```

---

### Task 3: Página `/usuarios` (solo admin) + enlace en el menú del navbar

**Files:**
- Create: `src/app/features/admin/users-admin.component.ts`
- Modify: `src/app/app.routes.ts` (nueva ruta `usuarios`)
- Modify: `src/app/shared/layout/navbar.component.ts` (enlace "Usuarios" en el popover, solo admins)

**Interfaces:**
- Consumes: `CurrentUserStore.isAdmin` / `.members()` / `.currentId` / `.updateMember()`, `MembersService.list()` / `.updateRole()` (Task 2), `ToastService.success|error`, `AvatarComponent`, `IconComponent`.
- Produces: ruta `/usuarios`. La seguridad real es RLS (un empleado que fuerce la URL ve un aviso y el trigger de BD bloquea cualquier UPDATE de rol).

- [ ] **Step 1: Crear el componente**

`src/app/features/admin/users-admin.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrentUserStore } from '../../core/current-user.store';
import { MembersService } from '../../core/services/members.service';
import { ToastService } from '../../core/toast.service';
import { Member, MemberRole } from '../../core/models/models';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Panel de administración de roles. Visible solo para admins; la protección
 * real está en la base (RLS + trigger que solo deja a admins cambiar roles).
 */
@Component({
  selector: 'app-users-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent],
  template: `
    <section class="mx-auto min-h-full max-w-3xl bg-background px-6 py-8">
      @if (!user.isAdmin()) {
        <div class="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <app-icon name="lock" [size]="28" />
          <h1 class="text-lg font-semibold text-foreground">Solo administradores</h1>
          <p class="text-sm text-muted-foreground">No tienes permisos para gestionar usuarios.</p>
        </div>
      } @else {
        <header class="mb-6">
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Los administradores ven y gestionan todos los tableros; los empleados solo los tableros donde son miembros.
          </p>
        </header>

        <ul class="divide-y divide-border rounded-xl border border-border bg-card">
          @for (m of user.members(); track m.id) {
            <li class="flex items-center gap-3 px-4 py-3">
              <app-avatar [member]="m" [size]="32" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-foreground">{{ m.name }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ m.email }}</p>
              </div>
              <select
                class="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                [value]="m.role ?? 'empleado'"
                [disabled]="m.id === user.currentId() || saving() === m.id"
                (change)="changeRole(m, $event)"
                [title]="m.id === user.currentId() ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'"
              >
                <option value="admin">Admin</option>
                <option value="empleado">Empleado</option>
              </select>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class UsersAdminComponent {
  user = inject(CurrentUserStore);
  private membersSvc = inject(MembersService);
  private toast = inject(ToastService);

  readonly saving = signal<string | null>(null);

  async changeRole(member: Member, event: Event) {
    const role = (event.target as HTMLSelectElement).value as MemberRole;
    if (role === (member.role ?? 'empleado')) return;
    this.saving.set(member.id);
    try {
      await this.membersSvc.updateRole(member.id, role);
      this.user.updateMember({ ...member, role });
      this.toast.success(`${member.name} ahora es ${role}`);
    } catch {
      this.toast.error('No se pudo cambiar el rol');
      (event.target as HTMLSelectElement).value = member.role ?? 'empleado';
    } finally {
      this.saving.set(null);
    }
  }
}
```

Nota: si `ToastService` no expone `success`, usar el método equivalente que exista (revisar `src/app/core/toast.service.ts`) — mantener el patrón del resto de la app. Si el icono `lock` no existe en `IconComponent`, usar uno existente (p. ej. `x` o `user`), comprobando el catálogo en `src/app/shared/ui/icon.component.ts`.

- [ ] **Step 2: Registrar la ruta**

En `src/app/app.routes.ts`, tras la ruta `my-cards`:

```ts
{
  path: 'usuarios',
  canActivate: [authGuard],
  loadComponent: () =>
    import('./features/admin/users-admin.component').then((m) => m.UsersAdminComponent),
},
```

- [ ] **Step 3: Enlace en el navbar (solo admins)**

En `src/app/shared/layout/navbar.component.ts`, dentro del panel del popover de usuario, entre el bloque del perfil y el divisor previo a "Cerrar sesión":

```html
@if (user.isAdmin()) {
  <div class="my-1 h-px bg-border"></div>
  <a
    routerLink="/usuarios"
    (click)="userPop.close()"
    class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
  >
    <app-icon name="users" [size]="16" /> Usuarios
  </a>
}
```

(El `RouterLink` ya está importado en el componente. Verificar que exista el icono `users`; si no, usar `user` o el más parecido del catálogo.)

- [ ] **Step 4: Tests + build**

Run: `npm test -- --watch=false --browsers=ChromeHeadless` → PASS
Run: `npm run build` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/users-admin.component.ts src/app/app.routes.ts src/app/shared/layout/navbar.component.ts
git commit -m "Panel de usuarios para administrar roles"
```

---

### Task 4: Verificación end-to-end y push

**Files:**
- Ninguno nuevo (verificación y push).

**Interfaces:**
- Consumes: todo lo anterior desplegado en Supabase + código local.

- [ ] **Step 1: Suite completa y build**

Run: `npm test -- --watch=false --browsers=ChromeHeadless` → PASS
Run: `npm run build` → OK

- [ ] **Step 2: Re-verificar RLS con los tres usuarios (SQL)**

Repetir las consultas del Task 1 Step 4 para los tres `sub` (admin `d7134804-660c-49c9-bfeb-13d17a862226`, soledadc `1497fde6-6ebb-4e0b-8af3-2af39f152392`, vicented `d2b376dc-ab18-4efb-981d-7e953d664780`) y confirmar: admins ven 2 tableros, vicented solo los suyos.

- [ ] **Step 3: Smoke test en la app (opcional si hay navegador disponible)**

Con Claude in Chrome: login como vicented → la home solo lista sus tableros y el menú de usuario NO muestra "Usuarios". Login como admin → ve todos los tableros y puede abrir `/usuarios` y cambiar el rol de vicented (y revertirlo).

- [ ] **Step 4: Push (deploy Vercel)**

```bash
git push
```

Esperado: push a `main` de 6h0T/trello-boston dispara deploy en Vercel.
