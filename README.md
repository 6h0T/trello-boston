# Boston Boards — Tablero colaborativo (Trello clone)

Aplicación tipo **Trello** construida con **Angular 20** (standalone + signals), **Tailwind CSS** y **Supabase**, con la estética del UI kit **Boston Asset Manager** (navy `#1d3969`, accent `#2563eb`, tipografía Geist, modo claro/oscuro).

Tableros con tareas compartidas, asignables a cada miembro, multiusuario en tiempo real.

---

## 🚀 Puesta en marcha

```bash
npm install
npm start            # ng serve → http://localhost:4200
```

> Las tablas de Supabase ya están creadas. Para recrearlas en otro proyecto, ver **[docs/SUPABASE.md](docs/SUPABASE.md)**.

Build de producción:
```bash
npm run build
```

---

## ✨ Funcionalidades (estilo Trello)

- **Tableros**: crear, renombrar, destacar (⭐), 8 fondos de color, eliminar.
- **Listas/columnas**: crear, renombrar, archivar, reordenar con drag & drop.
- **Tarjetas**: crear, editar título y descripción, mover entre listas con drag & drop, archivar, eliminar.
- **Etiquetas** de color (crear/asignar), **fechas de entrega** (con estado vencida/próxima/completada), **portada** de color.
- **Checklists** con ítems y barra de progreso.
- **Miembros**: selector de usuario (auth mock), asignación a tarjetas, miembros de tablero, avatares.
- **Comentarios** por tarjeta.
- **Filtros**: por texto, miembro, etiqueta y fecha.
- **Actividad**: panel lateral con el log del tablero.
- **Tiempo real**: cambios sincronizados entre usuarios vía Supabase Realtime.
- **Tema** claro/oscuro y toasts.

---

## 🏗️ Arquitectura

```
src/app/
├── core/                      # estado y acceso a datos (compartido)
│   ├── models/models.ts       # interfaces de dominio (alineadas a tb_*)
│   ├── supabase.service.ts    # cliente Supabase (prefijo tb_ automático)
│   ├── board.store.ts         # estado del tablero abierto (signals) + drag&drop
│   ├── filter.service.ts      # estado de filtros
│   ├── current-user.store.ts  # usuario actual (mock)
│   ├── theme.service.ts / toast.service.ts / confirm/
│   ├── util/{position,date}.ts
│   └── services/*.service.ts  # boards, lists, cards, labels, checklists,
│                              # comments, members, activity, realtime
├── shared/
│   ├── ui/                    # UI kit Boston (button, icon, avatar, badge,
│   │                          # modal, popover, spinner, toast, click-outside)
│   │   └── extras/            # empty-state, skeleton
│   └── layout/navbar.component.ts
└── features/
    ├── boards-home/           # dashboard de tableros
    ├── board/                 # canvas: board-view, list-column, card-tile, add-list
    ├── card-detail/           # modal de detalle (ruta hija) + panels/
    └── board-extras/          # filter-bar, board-members, activity-sidebar
```

**Patrón de estado:** `BoardStore` (provisto a nivel de ruta `board/:id`) mantiene listas/tarjetas/etiquetas/miembros en *signals*; el canvas y el modal de detalle comparten ese estado. El orden usa posiciones fraccionales (`position`) para mover sin renumerar.

---

## 🗄️ Backend (Supabase)

- Proyecto: `irdzqnwkxjlinufbtggx`, tablas con prefijo `tb_`.
- Esquema, RLS, Realtime y seed documentados en **[docs/SUPABASE.md](docs/SUPABASE.md)**.
- Scripts SQL: `docs/migrations/001_schema.sql` y `docs/migrations/002_seed_and_realtime.sql`.
- Credenciales del frontend en `src/environments/environment.ts` (key *publishable*, segura para el cliente).

---

## 🎨 Diseño

Tokens portados de `boston-ar` (`src/styles.css` + `tailwind.config.js`): paleta navy/accent, radios, sombras suaves y variables `oklch` para light/dark.
