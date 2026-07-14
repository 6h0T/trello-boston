import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { Card, List } from '../../core/models/models';
import { BoardStore } from '../../core/board.store';
import { FilterService } from '../../core/filter.service';
import { ListsService } from '../../core/services/lists.service';
import { CardsService } from '../../core/services/cards.service';
import { ActivityService } from '../../core/services/activity.service';
import { CurrentUserStore } from '../../core/current-user.store';
import { ToastService } from '../../core/toast.service';
import { ButtonComponent, IconComponent, PopoverComponent } from '../../shared/ui';
import { CardTileComponent } from './card-tile.component';

/**
 * Columna (lista) del tablero: cabecera editable, lista de cards con drag&drop
 * y composer para agregar tarjetas.
 */
@Component({
  selector: 'app-list-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CdkDropList,
    CdkDrag,
    IconComponent,
    ButtonComponent,
    PopoverComponent,
    CardTileComponent,
  ],
  template: `
    <!-- El cdkDropList vive en la raíz para que toda la columna (cabecera,
         zona vacía y composer) acepte drops; con el drop list en el div de
         cards, una lista vacía ofrecía un blanco de 8px y el drop fallaba.
         Se conecta por ids (cdkDropListConnectedTo) y no por cdkDropListGroup:
         el cdkDropList exterior de columnas provee CDK_DROP_LIST_GROUP=undefined
         a sus descendientes, así que un grupo nunca alcanza a estas listas. -->
    <div
      cdkDropList
      [id]="list.id"
      [cdkDropListData]="list.id"
      [cdkDropListConnectedTo]="connectedListIds()"
      (cdkDropListDropped)="onDrop($event)"
      class="w-72 shrink-0 bg-[#f1f2f4] dark:bg-slate-800 rounded-xl p-2 flex flex-col max-h-full"
    >
      <!-- Cabecera -->
      <div class="flex items-center gap-1 px-1 mb-1">
        @if (editingTitle()) {
          <input
            #titleInput
            autofocus
            class="flex-1 min-w-0 bg-white dark:bg-slate-700 rounded px-2 py-1 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none ring-2 ring-[#2563eb]"
            [ngModel]="list.title"
            (keydown.enter)="commitTitle(titleInput.value)"
            (keydown.escape)="editingTitle.set(false)"
            (blur)="commitTitle(titleInput.value)"
          />
        } @else {
          <h3
            class="flex-1 min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-100 px-2 py-1 cursor-pointer"
            (click)="startEditTitle()"
          >
            {{ list.title }}
          </h3>
        }
        <span class="text-xs text-slate-400 px-1 tabular-nums">{{ cards().length }}</span>

        <app-popover #menu="popover" align="end">
          <button
            trigger
            class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
            title="Acciones de la lista"
          >
            <app-icon name="more-horizontal" [size]="16" />
          </button>
          <div panel class="py-1 w-52">
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              (click)="archiveList(); menu.close()"
            >
              <app-icon name="archive" [size]="16" /> Archivar lista
            </button>
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              (click)="deleteList(); menu.close()"
            >
              <app-icon name="trash" [size]="16" /> Eliminar
            </button>
          </div>
        </app-popover>
      </div>

      <!-- Cards -->
      <div class="flex-1 overflow-y-auto scrollbar-thin px-0.5 min-h-[8px]">
        @for (c of cards(); track c.id) {
          <app-card-tile [card]="c" cdkDrag [cdkDragData]="c" />
        }
      </div>

      <!-- Composer -->
      @if (composing()) {
        <div class="mt-1 px-0.5">
          <textarea
            #composer
            class="w-full resize-none rounded-lg border border-[#2563eb] bg-white dark:bg-slate-700 p-2 text-sm text-slate-800 dark:text-slate-100 outline-none"
            rows="2"
            placeholder="Ingresá un título para esta tarjeta…"
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
            (keydown.enter)="$event.preventDefault(); addCard(composer)"
            (keydown.escape)="cancelCompose()"
          ></textarea>
          <div class="flex items-center gap-2 mt-1">
            <app-button size="sm" variant="primary" (click)="addCard(composer)" [disabled]="saving()">
              Agregar tarjeta
            </app-button>
            <button
              class="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-black/5"
              (click)="cancelCompose()"
              title="Cancelar"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
        </div>
      } @else {
        <button
          class="mt-1 flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
          (click)="startCompose()"
        >
          <app-icon name="plus" [size]="16" /> Agregar tarjeta
        </button>
      }
    </div>
  `,
})
export class ListColumnComponent {
  @Input({ required: true }) list!: List;

  private store = inject(BoardStore);
  private filter = inject(FilterService);
  private listsSvc = inject(ListsService);
  private cardsSvc = inject(CardsService);
  private activity = inject(ActivityService);
  private currentUser = inject(CurrentUserStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly editingTitle = signal(false);
  readonly composing = signal(false);
  readonly draft = signal('');
  readonly saving = signal(false);

  /** Cards de esta lista que pasan el filtro activo. */
  readonly cards = computed<Card[]>(() =>
    this.store.cardsForList(this.list.id).filter((c) => this.filter.matches(c)),
  );

  /** Ids de las demás listas del tablero, para conectar el drag&drop de cards. */
  readonly connectedListIds = computed<string[]>(() =>
    this.store
      .lists()
      .map((l) => l.id)
      .filter((id) => id !== this.list.id),
  );

  startEditTitle() {
    this.editingTitle.set(true);
  }

  async commitTitle(value: string) {
    const title = value.trim();
    this.editingTitle.set(false);
    if (!title || title === this.list.title) return;
    try {
      await this.listsSvc.rename(this.list.id, title);
      await this.store.reload();
    } catch {
      this.toast.error('No se pudo renombrar la lista');
    }
  }

  async archiveList() {
    try {
      await this.listsSvc.setArchived(this.list.id, true);
      await this.store.reload();
      this.toast.success('Lista archivada');
    } catch {
      this.toast.error('No se pudo archivar la lista');
    }
  }

  async deleteList() {
    if (!confirm(`¿Eliminar la lista "${this.list.title}" y sus tarjetas?`)) return;
    try {
      await this.listsSvc.delete(this.list.id);
      await this.store.reload();
      this.toast.success('Lista eliminada');
    } catch {
      this.toast.error('No se pudo eliminar la lista');
    }
  }

  startCompose() {
    this.composing.set(true);
    this.draft.set('');
  }

  cancelCompose() {
    this.composing.set(false);
    this.draft.set('');
  }

  async addCard(textarea: HTMLTextAreaElement) {
    const title = this.draft().trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    try {
      const nueva = await this.cardsSvc.create(
        this.list.id,
        this.list.board_id,
        title,
        this.store.nextCardPosition(this.list.id),
      );
      await this.store.reload();
      this.activity.log(this.list.board_id, 'card.created', {
        cardId: nueva.id,
        memberId: this.currentUser.currentId(),
        data: { title },
      });
      // Mantener el composer abierto para añadir varias
      this.draft.set('');
      textarea.focus();
    } catch {
      this.toast.error('No se pudo crear la tarjeta');
    } finally {
      this.saving.set(false);
    }
  }

  async onDrop(event: CdkDragDrop<string>) {
    const card = event.item.data as Card;
    if (!card) return;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    await this.store.moveCard(card.id, this.list.id, event.currentIndex);
  }
}
