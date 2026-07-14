import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  BOARD_BACKGROUNDS,
  BoardBackground,
  boardBgClass,
} from '../../core/models/models';
import { BoardStore } from '../../core/board.store';
import { FilterService } from '../../core/filter.service';
import { ChromeService } from '../../core/chrome.service';
import { BoardsService } from '../../core/services/boards.service';
import { StorageService } from '../../core/services/storage.service';
import { CurrentUserStore } from '../../core/current-user.store';
import { ToastService } from '../../core/toast.service';
import {
  IconComponent,
  PopoverComponent,
  SpinnerComponent,
} from '../../shared/ui';
import { ListColumnComponent } from './list-column.component';
import { AddListComponent } from './add-list.component';
// board-extras (AGENTE 4) — selectores garantizados. Si aún no existen al compilar,
// la integración final los resuelve.
import { FilterBarComponent } from '../board-extras/filter-bar.component';
import { BoardMembersComponent } from '../board-extras/board-members.component';
import { ActivitySidebarComponent } from '../board-extras/activity-sidebar.component';

/**
 * Vista principal de un tablero: cabecera + canvas horizontal de listas con
 * drag&drop (reordenar columnas y mover tarjetas). Provee BoardStore y
 * FilterService a nivel de ruta, y aloja la ruta hija del detalle de tarjeta.
 */
@Component({
  selector: 'app-board-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    FormsModule,
    RouterOutlet,
    CdkDropList,
    CdkDrag,
    IconComponent,
    PopoverComponent,
    SpinnerComponent,
    ListColumnComponent,
    AddListComponent,
    FilterBarComponent,
    BoardMembersComponent,
    ActivitySidebarComponent,
  ],
  providers: [BoardStore, FilterService],
  template: `
    <div
      class="h-full flex flex-col min-h-0 bg-cover bg-center"
      [ngClass]="bgClass()"
      [style.background-image]="bgImage()"
    >
      <!-- Cabecera -->
      <header
        class="flex items-center gap-2 bg-black/20 text-white backdrop-blur px-4 py-2 shrink-0"
      >
        <button
          class="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/15"
          title="Volver a tableros"
          (click)="goBack()"
        >
          <app-icon name="arrow-left" [size]="18" />
        </button>

        <!-- Título editable -->
        @if (editingTitle()) {
          <input
            #titleInput
            autofocus
            class="bg-white/15 rounded px-2 py-1 text-base font-semibold outline-none ring-2 ring-white/50 min-w-[8rem]"
            [ngModel]="store.board()?.title"
            (keydown.enter)="commitTitle(titleInput.value)"
            (keydown.escape)="editingTitle.set(false)"
            (blur)="commitTitle(titleInput.value)"
          />
        } @else {
          <h1
            class="text-base font-semibold px-2 py-1 rounded hover:bg-white/10 cursor-pointer truncate max-w-[16rem]"
            (click)="startEditTitle()"
          >
            {{ store.board()?.title }}
          </h1>
        }

        <!-- Estrella -->
        <button
          class="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/15"
          [title]="store.board()?.starred ? 'Quitar de destacados' : 'Destacar tablero'"
          (click)="toggleStar()"
        >
          <app-icon
            name="star"
            [size]="18"
            [class.text-amber-300]="store.board()?.starred"
          />
        </button>

        <div class="w-px h-6 bg-white/20 mx-1"></div>

        <app-board-members />
        <app-filter-bar />

        <div class="flex-1"></div>

        <!-- Actividad -->
        <button
          class="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm hover:bg-white/15"
          (click)="showActivity.set(!showActivity())"
          title="Actividad"
        >
          <app-icon name="activity" [size]="16" /> Actividad
        </button>

        <!-- Menú -->
        <app-popover #menu="popover" align="end">
          <button
            trigger
            class="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/15"
            title="Más acciones"
          >
            <app-icon name="more-horizontal" [size]="18" />
          </button>
          <div panel class="py-2 w-64">
            <div class="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cambiar fondo
            </div>
            <div class="grid grid-cols-4 gap-2 px-3 pb-2">
              @for (bg of backgrounds; track bg.key) {
                <button
                  class="h-9 rounded-md transition-transform hover:scale-105"
                  [ngClass]="[bg.class, store.board()?.background === bg.key ? 'ring-2 ring-[#2563eb]' : 'ring-1 ring-black/10']"
                  [title]="bg.label"
                  (click)="changeBackground(bg.key); menu.close()"
                ></button>
              }
            </div>
            <div class="border-t border-border my-1"></div>
            <input
              #bgFile
              type="file"
              accept="image/*"
              class="hidden"
              (change)="onBgFileSelected($event); menu.close()"
            />
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              (click)="bgFile.click()"
            >
              <app-icon name="plus" [size]="16" />
              {{ store.board()?.background_image_url ? 'Cambiar imagen de fondo' : 'Subir imagen de fondo' }}
            </button>
            @if (store.board()?.background_image_url) {
              <button
                class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                (click)="removeBgImage(); menu.close()"
              >
                <app-icon name="x" [size]="16" /> Quitar imagen de fondo
              </button>
            }
            <div class="border-t border-border my-1"></div>
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              (click)="deleteBoard(); menu.close()"
            >
              <app-icon name="trash" [size]="16" /> Eliminar tablero
            </button>
          </div>
        </app-popover>
      </header>

      <!-- Cuerpo -->
      @if (store.loading()) {
        <div class="flex-1 flex items-center justify-center">
          <app-spinner [size]="40" />
        </div>
      } @else {
        <!-- Sin cdkDropListGroup: este cdkDropList (columnas) bloquea el token
             del grupo para sus descendientes, así que las listas de cards se
             conectan entre sí por id (ver list-column.component.ts). -->
        <div
          cdkDropList
          cdkDropListOrientation="horizontal"
          [cdkDropListData]="store.lists()"
          (cdkDropListDropped)="onListDrop($event)"
          class="flex-1 min-h-0 flex gap-3 overflow-x-auto scrollbar-thin p-3 items-start"
        >
          @for (list of store.lists(); track list.id) {
            <app-list-column [list]="list" cdkDrag [cdkDragData]="list" />
          }
          <app-add-list />
        </div>
      }
    </div>

    <app-activity-sidebar [open]="showActivity()" (closed)="showActivity.set(false)" />

    <router-outlet />
  `,
})
export class BoardViewComponent implements OnInit, OnDestroy {
  protected store = inject(BoardStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private boardsSvc = inject(BoardsService);
  private storage = inject(StorageService);
  private currentUser = inject(CurrentUserStore);
  private toast = inject(ToastService);
  private chrome = inject(ChromeService);

  constructor() {
    // El navbar se tiñe con el fondo del tablero cargado. El effect reacciona
    // a los cambios del signal board().
    effect(() => {
      const bg = this.store.board()?.background;
      this.chrome.setBackground(bg ?? null);
    });
  }

  readonly editingTitle = signal(false);
  readonly showActivity = signal(false);

  readonly backgrounds = BOARD_BACKGROUNDS;

  private sub?: Subscription;
  private boardId: string | null = null;

  bgClass(): string {
    return boardBgClass(this.store.board()?.background);
  }

  bgImage(): string | null {
    const url = this.store.board()?.background_image_url;
    return url ? `url("${url}")` : null;
  }

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.boardId) {
        this.boardId = id;
        this.store.load(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.chrome.clear();
    this.store.destroy();
  }

  startEditTitle() {
    this.editingTitle.set(true);
  }

  async commitTitle(value: string) {
    const title = value.trim();
    this.editingTitle.set(false);
    const board = this.store.board();
    if (!board || !title || title === board.title) return;
    try {
      await this.boardsSvc.update(board.id, { title });
      await this.store.reloadBoard();
    } catch {
      this.toast.error('No se pudo renombrar el tablero');
    }
  }

  async toggleStar() {
    const board = this.store.board();
    if (!board) return;
    try {
      await this.boardsSvc.toggleStar(board.id, !board.starred);
      await this.store.reloadBoard();
    } catch {
      this.toast.error('No se pudo actualizar el tablero');
    }
  }

  async changeBackground(key: BoardBackground) {
    const board = this.store.board();
    if (!board) return;
    try {
      // Elegir un color reemplaza a la imagen (la imagen manda cuando existe).
      await this.boardsSvc.update(board.id, { background: key, background_image_url: null });
      await this.store.reloadBoard();
    } catch {
      this.toast.error('No se pudo cambiar el fondo');
    }
  }

  async onBgFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const board = this.store.board();
    if (!file || !board) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('El archivo debe ser una imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('La imagen no puede superar los 5 MB');
      return;
    }
    try {
      const url = await this.storage.upload(file, file.name, 'boards');
      await this.boardsSvc.update(board.id, { background_image_url: url });
      await this.store.reloadBoard();
    } catch {
      this.toast.error('No se pudo subir la imagen');
    }
  }

  async removeBgImage() {
    const board = this.store.board();
    if (!board) return;
    try {
      await this.boardsSvc.update(board.id, { background_image_url: null });
      await this.store.reloadBoard();
    } catch {
      this.toast.error('No se pudo quitar la imagen');
    }
  }

  async deleteBoard() {
    const board = this.store.board();
    if (!board) return;
    if (!confirm(`¿Eliminar el tablero "${board.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.boardsSvc.delete(board.id);
      this.toast.success('Tablero eliminado');
      this.router.navigate(['/boards']);
    } catch {
      this.toast.error('No se pudo eliminar el tablero');
    }
  }

  goBack() {
    this.router.navigate(['/boards']);
  }

  async onListDrop(event: CdkDragDrop<any>) {
    if (event.previousIndex === event.currentIndex) return;
    const list = event.item.data as { id: string } | undefined;
    if (!list) return;
    await this.store.moveList(list.id, event.currentIndex);
  }
}
