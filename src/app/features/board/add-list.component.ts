import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardStore } from '../../core/board.store';
import { ListsService } from '../../core/services/lists.service';
import { ToastService } from '../../core/toast.service';
import { ButtonComponent, IconComponent } from '../../shared/ui';

/**
 * Tarjeta-formulario al final del tablero para crear nuevas listas.
 */
@Component({
  selector: 'app-add-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, ButtonComponent],
  template: `
    <div class="w-72 shrink-0">
      @if (open()) {
        <div class="bg-white/95 dark:bg-slate-800 rounded-xl p-2 shadow">
          <input
            #input
            autofocus
            class="w-full rounded-lg border border-[#2563eb] bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 outline-none"
            placeholder="Ingresá el título de la lista…"
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
            (keydown.enter)="add(input)"
            (keydown.escape)="cancel()"
          />
          <div class="flex items-center gap-2 mt-1">
            <app-button size="sm" variant="primary" (click)="add(input)" [disabled]="saving()">
              Agregar lista
            </app-button>
            <button
              class="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-black/5"
              (click)="cancel()"
              title="Cancelar"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
        </div>
      } @else {
        <button
          class="flex items-center gap-2 w-full rounded-xl bg-white/30 hover:bg-white/40 text-white px-3 py-2 text-sm font-medium backdrop-blur transition-colors"
          (click)="start()"
        >
          <app-icon name="plus" [size]="16" /> Agregar otra lista
        </button>
      }
    </div>
  `,
})
export class AddListComponent {
  private store = inject(BoardStore);
  private listsSvc = inject(ListsService);
  private toast = inject(ToastService);

  readonly open = signal(false);
  readonly draft = signal('');
  readonly saving = signal(false);

  start() {
    this.open.set(true);
    this.draft.set('');
  }

  cancel() {
    this.open.set(false);
    this.draft.set('');
  }

  async add(input: HTMLInputElement) {
    const title = this.draft().trim();
    const board = this.store.board();
    if (!title || !board || this.saving()) return;
    this.saving.set(true);
    try {
      await this.listsSvc.create(board.id, title, this.store.nextListPosition());
      await this.store.reload();
      // Mantener abierto para añadir varias
      this.draft.set('');
      input.focus();
    } catch {
      this.toast.error('No se pudo crear la lista');
    } finally {
      this.saving.set(false);
    }
  }
}
