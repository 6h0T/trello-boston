import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ButtonComponent,
  IconComponent,
  ModalComponent,
  SpinnerComponent,
} from '../../shared/ui';
import {
  Board,
  BOARD_BACKGROUNDS,
  BoardBackground,
} from '../../core/models/models';
import { BoardsService } from '../../core/services/boards.service';
import { StorageService } from '../../core/services/storage.service';
import { CurrentUserStore } from '../../core/current-user.store';
import { ToastService } from '../../core/toast.service';
import { BoardCardComponent } from './board-card.component';

type ModalKind = 'create' | 'rename' | 'background';

/** Nombres de columna por defecto según la cantidad elegida (1, 2 o 3). */
const DEFAULT_COLUMN_NAMES: Record<1 | 2 | 3, string[]> = {
  1: ['Tareas'],
  2: ['Por hacer', 'Hecho'],
  3: ['Por hacer', 'En progreso', 'Hecho'],
};

@Component({
  selector: 'app-boards-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconComponent,
    ModalComponent,
    SpinnerComponent,
    BoardCardComponent,
  ],
  template: `
    <section class="mx-auto min-h-full max-w-6xl bg-background px-6 py-8">
      <!-- Cabecera -->
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Tus tableros
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Organiza tus proyectos en tableros visuales.
          </p>
        </div>
        @if (!loading() && boards().length > 0) {
          <app-button variant="primary" size="md" (click)="openCreate()">
            <app-icon name="plus" [size]="16" /> Crear tablero
          </app-button>
        }
      </header>

      <!-- Estado de carga -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <app-spinner [size]="36" />
          <span class="text-sm">Cargando tableros…</span>
        </div>
      } @else if (boards().length === 0) {
        <!-- Estado vacío -->
        <div
          class="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center"
        >
          <span class="grid h-16 w-16 place-items-center rounded-2xl bg-brand-navy/10 text-brand-navy">
            <app-icon name="layout" [size]="32" />
          </span>
          <div>
            <h2 class="text-lg font-semibold text-foreground">Aún no tienes tableros</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Crea tu primer tablero para empezar a organizar tu trabajo.
            </p>
          </div>
          <app-button variant="primary" size="md" (click)="openCreate()">
            <app-icon name="plus" [size]="16" /> Crear tu primer tablero
          </app-button>
        </div>
      } @else {
        <!-- Sección Destacados -->
        @if (starred().length > 0) {
          <div class="mb-8">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span aria-hidden="true">⭐</span> Destacados
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (b of starred(); track b.id) {
                <app-board-card
                  [board]="b"
                  (toggleStar)="onToggleStar($event)"
                  (rename)="openRename($event)"
                  (changeBackground)="openBackground($event)"
                  (remove)="onRemove($event)"
                />
              }
            </div>
          </div>
        }

        <!-- Sección Todos los tableros -->
        <div>
          <h2 class="mb-3 text-sm font-semibold text-foreground">Todos los tableros</h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (b of boards(); track b.id) {
              <app-board-card
                [board]="b"
                (toggleStar)="onToggleStar($event)"
                (rename)="openRename($event)"
                (changeBackground)="openBackground($event)"
                (remove)="onRemove($event)"
              />
            }
          </div>
        </div>
      }
    </section>

    <!-- ============ Modal: Crear tablero ============ -->
    <app-modal [open]="modal() === 'create'" width="max-w-lg" (closed)="closeModal()">
      <form class="p-5" (submit)="submitCreate($event)">
        <h2 class="mb-4 text-lg font-semibold text-card-foreground">Crear tablero</h2>

        <label for="new-board-title" class="mb-1.5 block text-sm font-medium text-card-foreground">
          Título del tablero
        </label>
        <input
          #titleInput
          id="new-board-title"
          type="text"
          autofocus
          [value]="draftTitle()"
          (input)="draftTitle.set(titleInput.value)"
          placeholder="Ej. Plan de marketing"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
        />

        <p class="mb-2 mt-5 text-sm font-medium text-card-foreground">Fondo</p>
        <div class="grid grid-cols-4 gap-2">
          @for (bg of backgrounds; track bg.key) {
            <button
              type="button"
              [class]="bg.class"
              class="relative h-12 rounded-md ring-offset-2 ring-offset-card transition focus:outline-none"
              [class.ring-2]="draftBg() === bg.key"
              [class.ring-brand-accent]="draftBg() === bg.key"
              [attr.aria-label]="bg.label"
              [attr.aria-pressed]="draftBg() === bg.key"
              (click)="draftBg.set(bg.key)"
            >
              @if (draftBg() === bg.key) {
                <span class="absolute inset-0 grid place-items-center text-white">
                  <app-icon name="check" [size]="18" />
                </span>
              }
            </button>
          }
        </div>

        <!-- Columnas iniciales -->
        <p class="mb-2 mt-5 text-sm font-medium text-card-foreground">Columnas iniciales</p>

        <!-- Selector de cantidad (segmented) -->
        <div
          class="inline-flex rounded-md border border-input bg-background p-0.5"
          role="group"
          aria-label="Cantidad de columnas"
        >
          @for (count of columnOptions; track count) {
            <button
              type="button"
              class="min-w-10 rounded px-3 py-1.5 text-sm font-medium transition focus:outline-none"
              [class.bg-brand-accent]="columnCount() === count"
              [class.text-white]="columnCount() === count"
              [class.text-muted-foreground]="columnCount() !== count"
              [class.hover:text-foreground]="columnCount() !== count"
              [attr.aria-pressed]="columnCount() === count"
              (click)="setColumnCount(count)"
            >
              {{ count }}
            </button>
          }
        </div>

        <!-- Inputs de nombre por columna -->
        <div class="mt-3 space-y-2">
          @for (name of visibleColumnNames(); track $index) {
            <div class="flex items-center gap-2">
              <span
                class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-navy/10 text-xs font-semibold text-brand-navy"
                aria-hidden="true"
              >
                {{ $index + 1 }}
              </span>
              <input
                #colInput
                type="text"
                [value]="name"
                (input)="setColumnName($index, colInput.value)"
                [attr.aria-label]="'Nombre de la columna ' + ($index + 1)"
                [placeholder]="'Columna ' + ($index + 1)"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
              />
            </div>
          }
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <app-button variant="subtle" size="md" type="button" (click)="closeModal()">
            Cancelar
          </app-button>
          <app-button variant="primary" size="md" type="submit" [disabled]="!canCreate() || saving()">
            @if (saving()) {
              <app-spinner [size]="16" />
            }
            Crear
          </app-button>
        </div>
      </form>
    </app-modal>

    <!-- ============ Modal: Renombrar ============ -->
    <app-modal [open]="modal() === 'rename'" width="max-w-md" (closed)="closeModal()">
      <form class="p-5" (submit)="submitRename($event)">
        <h2 class="mb-4 text-lg font-semibold text-card-foreground">Renombrar tablero</h2>
        <label for="rename-title" class="mb-1.5 block text-sm font-medium text-card-foreground">
          Nuevo título
        </label>
        <input
          #renameInput
          id="rename-title"
          type="text"
          autofocus
          [value]="draftTitle()"
          (input)="draftTitle.set(renameInput.value)"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
        />
        <div class="mt-6 flex justify-end gap-2">
          <app-button variant="subtle" size="md" type="button" (click)="closeModal()">
            Cancelar
          </app-button>
          <app-button
            variant="primary"
            size="md"
            type="submit"
            [disabled]="draftTitle().trim().length === 0 || saving()"
          >
            @if (saving()) {
              <app-spinner [size]="16" />
            }
            Guardar
          </app-button>
        </div>
      </form>
    </app-modal>

    <!-- ============ Modal: Cambiar fondo ============ -->
    <app-modal [open]="modal() === 'background'" width="max-w-lg" (closed)="closeModal()">
      <div class="p-5">
        <h2 class="mb-4 text-lg font-semibold text-card-foreground">Cambiar fondo</h2>

        <!-- Imagen de fondo -->
        <p class="mb-2 text-sm font-medium text-card-foreground">Imagen</p>
        @if (editing()?.background_image_url; as imgUrl) {
          <div class="mb-3 overflow-hidden rounded-md border border-border">
            <img [src]="imgUrl" alt="Fondo actual" class="h-28 w-full object-cover" />
          </div>
        }
        <input
          #bgFile
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onBgFileSelected($event)"
        />
        <div class="mb-5 flex gap-2">
          <app-button variant="subtle" size="sm" type="button" [disabled]="saving()" (click)="bgFile.click()">
            <app-icon name="plus" [size]="14" />
            {{ editing()?.background_image_url ? 'Cambiar imagen' : 'Subir imagen' }}
          </app-button>
          @if (editing()?.background_image_url) {
            <app-button variant="ghost" size="sm" type="button" [disabled]="saving()" (click)="removeBgImage()">
              Quitar imagen
            </app-button>
          }
        </div>

        <p class="mb-2 text-sm font-medium text-card-foreground">Color</p>
        <div class="grid grid-cols-4 gap-2">
          @for (bg of backgrounds; track bg.key) {
            <button
              type="button"
              [class]="bg.class"
              class="relative h-14 rounded-md ring-offset-2 ring-offset-card transition focus:outline-none disabled:opacity-60"
              [class.ring-2]="draftBg() === bg.key"
              [class.ring-brand-accent]="draftBg() === bg.key"
              [attr.aria-label]="bg.label"
              [attr.aria-pressed]="draftBg() === bg.key"
              [disabled]="saving()"
              (click)="submitBackground(bg.key)"
            >
              @if (draftBg() === bg.key) {
                <span class="absolute inset-0 grid place-items-center text-white">
                  <app-icon name="check" [size]="18" />
                </span>
              }
            </button>
          }
        </div>
        <div class="mt-6 flex justify-end">
          <app-button variant="subtle" size="md" type="button" (click)="closeModal()">
            Cerrar
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
})
export class BoardsHomeComponent {
  private boardsService = inject(BoardsService);
  private storage = inject(StorageService);
  private currentUser = inject(CurrentUserStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly backgrounds = BOARD_BACKGROUNDS;

  readonly boards = signal<Board[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly starred = computed(() => this.boards().filter((b) => b.starred));

  // Estado de modales
  readonly modal = signal<ModalKind | null>(null);
  readonly draftTitle = signal('');
  readonly draftBg = signal<BoardBackground>('navy');
  readonly editing = signal<Board | null>(null);

  // Estado de columnas iniciales (solo modal de creación)
  readonly columnOptions: readonly (1 | 2 | 3)[] = [1, 2, 3];
  readonly columnCount = signal<1 | 2 | 3>(3);
  /** Hasta 3 nombres; se muestran solo los `columnCount()` primeros. */
  readonly columnNames = signal<string[]>([...DEFAULT_COLUMN_NAMES[3]]);

  /** Nombres visibles según la cantidad seleccionada. */
  readonly visibleColumnNames = computed(() =>
    this.columnNames().slice(0, this.columnCount()),
  );

  readonly canCreate = computed(() => this.draftTitle().trim().length > 0);

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.boardsService.list();
      this.boards.set(data);
    } catch {
      this.toast.error('No se pudieron cargar los tableros.');
    } finally {
      this.loading.set(false);
    }
  }

  // ---------- Apertura de modales ----------
  openCreate(): void {
    this.draftTitle.set('');
    this.draftBg.set('navy');
    this.columnCount.set(3);
    this.columnNames.set([...DEFAULT_COLUMN_NAMES[3]]);
    this.editing.set(null);
    this.modal.set('create');
  }

  /**
   * Cambia la cantidad de columnas. Reaplica los nombres por defecto de esa
   * cantidad solo en los huecos que estén vacíos, conservando lo ya escrito.
   */
  setColumnCount(count: 1 | 2 | 3): void {
    const defaults = DEFAULT_COLUMN_NAMES[count];
    this.columnNames.update((current) =>
      defaults.map((def, i) => {
        const existing = (current[i] ?? '').trim();
        return existing.length > 0 ? current[i] : def;
      }),
    );
    this.columnCount.set(count);
  }

  setColumnName(index: number, value: string): void {
    this.columnNames.update((names) => {
      const next = [...names];
      next[index] = value;
      return next;
    });
  }

  openRename(board: Board): void {
    this.editing.set(board);
    this.draftTitle.set(board.title);
    this.modal.set('rename');
  }

  openBackground(board: Board): void {
    this.editing.set(board);
    this.draftBg.set((board.background as BoardBackground) ?? 'navy');
    this.modal.set('background');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.editing.set(null);
  }

  // ---------- Acciones ----------
  async submitCreate(ev: Event): Promise<void> {
    ev.preventDefault();
    const title = this.draftTitle().trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    try {
      const listNames = this.visibleColumnNames()
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
      const board = await this.boardsService.createWithLists(
        title,
        this.draftBg(),
        this.currentUser.currentId(),
        listNames,
      );
      this.toast.success('Tablero creado.');
      this.modal.set(null);
      await this.router.navigate(['/board', board.id]);
    } catch {
      this.toast.error('No se pudo crear el tablero.');
    } finally {
      this.saving.set(false);
    }
  }

  async submitRename(ev: Event): Promise<void> {
    ev.preventDefault();
    const board = this.editing();
    const title = this.draftTitle().trim();
    if (!board || !title || this.saving()) return;
    this.saving.set(true);
    try {
      await this.boardsService.update(board.id, { title });
      this.patchBoard(board.id, { title });
      this.toast.success('Tablero renombrado.');
      this.modal.set(null);
      this.editing.set(null);
    } catch {
      this.toast.error('No se pudo renombrar el tablero.');
    } finally {
      this.saving.set(false);
    }
  }

  async submitBackground(bg: BoardBackground): Promise<void> {
    const board = this.editing();
    if (!board || this.saving()) return;
    this.draftBg.set(bg);
    this.saving.set(true);
    try {
      // Elegir un color reemplaza a la imagen (la imagen manda cuando existe).
      await this.boardsService.update(board.id, { background: bg, background_image_url: null });
      this.patchBoard(board.id, { background: bg, background_image_url: null });
      this.toast.success('Fondo actualizado.');
      this.modal.set(null);
      this.editing.set(null);
    } catch {
      this.toast.error('No se pudo cambiar el fondo.');
    } finally {
      this.saving.set(false);
    }
  }

  async onBgFileSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const board = this.editing();
    if (!file || !board || this.saving()) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('La imagen no puede superar los 5 MB.');
      return;
    }
    this.saving.set(true);
    try {
      const url = await this.storage.upload(file, file.name, 'boards');
      await this.boardsService.update(board.id, { background_image_url: url });
      this.patchBoard(board.id, { background_image_url: url });
      this.editing.update((b) => (b ? { ...b, background_image_url: url } : b));
      this.toast.success('Imagen de fondo actualizada.');
    } catch {
      this.toast.error('No se pudo subir la imagen.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeBgImage(): Promise<void> {
    const board = this.editing();
    if (!board || this.saving()) return;
    this.saving.set(true);
    try {
      await this.boardsService.update(board.id, { background_image_url: null });
      this.patchBoard(board.id, { background_image_url: null });
      this.editing.update((b) => (b ? { ...b, background_image_url: null } : b));
      this.toast.success('Imagen de fondo eliminada.');
    } catch {
      this.toast.error('No se pudo quitar la imagen.');
    } finally {
      this.saving.set(false);
    }
  }

  async onToggleStar(board: Board): Promise<void> {
    const next = !board.starred;
    // Optimista
    this.patchBoard(board.id, { starred: next });
    try {
      await this.boardsService.toggleStar(board.id, next);
    } catch {
      this.patchBoard(board.id, { starred: board.starred });
      this.toast.error('No se pudo actualizar el destacado.');
    }
  }

  async onRemove(board: Board): Promise<void> {
    const ok = confirm(`¿Eliminar el tablero "${board.title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    const prev = this.boards();
    this.boards.set(prev.filter((b) => b.id !== board.id));
    try {
      await this.boardsService.delete(board.id);
      this.toast.success('Tablero eliminado.');
    } catch {
      this.boards.set(prev);
      this.toast.error('No se pudo eliminar el tablero.');
    }
  }

  // ---------- Util ----------
  private patchBoard(id: string, patch: Partial<Board>): void {
    this.boards.update((list) =>
      list.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }
}
