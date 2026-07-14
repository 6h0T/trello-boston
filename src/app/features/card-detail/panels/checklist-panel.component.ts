import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, IconComponent } from '../../../shared/ui';
import { Checklist, ChecklistItem } from '../../../core/models/models';
import { ChecklistsService } from '../../../core/services/checklists.service';
import { ToastService } from '../../../core/toast.service';

/**
 * Renders a single checklist with progress, inline-editable title,
 * toggleable / editable / deletable items and an "add item" composer.
 * Emits (changed) after any persisted mutation so the parent can reload.
 */
@Component({
  selector: 'app-checklist-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, ButtonComponent],
  template: `
    <div class="rounded-lg">
      <!-- Header: title + delete -->
      <div class="flex items-start gap-2">
        <app-icon name="check-square" [size]="18" class="mt-1 text-slate-500" />
        <div class="flex-1">
          @if (editingTitle()) {
            <input
              class="w-full rounded-md border border-slate-300 bg-card px-2 py-1 text-sm font-semibold text-card-foreground focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              [(ngModel)]="titleDraft"
              (blur)="saveTitle()"
              (keydown.enter)="saveTitle(); $event.preventDefault()"
              (keydown.escape)="editingTitle.set(false)"
              autofocus
            />
          } @else {
            <button
              class="text-sm font-semibold text-card-foreground hover:underline"
              (click)="startEditTitle()"
            >
              {{ checklist.title }}
            </button>
          }
        </div>
        <button
          class="rounded p-1 text-slate-400 hover:bg-black/5 hover:text-red-600"
          title="Eliminar checklist"
          (click)="remove()"
        >
          <app-icon name="trash" [size]="16" />
        </button>
      </div>

      <!-- Progress -->
      <div class="ml-7 mt-2 flex items-center gap-2">
        <span class="w-9 text-right text-xs text-slate-500">{{ percent }}%</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            class="h-full rounded-full bg-[#2563eb] transition-all"
            [style.width.%]="percent"
          ></div>
        </div>
      </div>

      <!-- Items -->
      <ul class="ml-7 mt-3 space-y-1">
        @for (item of items(); track item.id) {
          <li class="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-black/5">
            <input
              type="checkbox"
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
              [checked]="item.done"
              (change)="toggle(item)"
            />
            @if (editingItemId() === item.id) {
              <input
                class="flex-1 rounded-md border border-slate-300 bg-card px-2 py-1 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                [(ngModel)]="itemDraft"
                (blur)="saveItem(item)"
                (keydown.enter)="saveItem(item); $event.preventDefault()"
                (keydown.escape)="editingItemId.set(null)"
                autofocus
              />
            } @else {
              <span
                class="flex-1 cursor-text text-sm"
                [class.text-slate-400]="item.done"
                [class.line-through]="item.done"
                (click)="startEditItem(item)"
              >{{ item.text }}</span>
            }
            <button
              class="rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
              title="Eliminar elemento"
              (click)="removeItem(item)"
            >
              <app-icon name="x" [size]="14" />
            </button>
          </li>
        }
      </ul>

      <!-- Add item -->
      <div class="ml-7 mt-2">
        @if (adding()) {
          <textarea
            class="w-full resize-none rounded-md border border-slate-300 bg-card px-2 py-1.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            rows="2"
            placeholder="Agregar un elemento…"
            [(ngModel)]="newItemText"
            (keydown.enter)="addItem(); $event.preventDefault()"
            (keydown.escape)="cancelAdd()"
            autofocus
          ></textarea>
          <div class="mt-1.5 flex items-center gap-2">
            <app-button size="sm" variant="primary" (click)="addItem()">Agregar</app-button>
            <app-button size="sm" variant="ghost" (click)="cancelAdd()">Cancelar</app-button>
          </div>
        } @else {
          <button
            class="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
            (click)="adding.set(true)"
          >
            Agregar un elemento
          </button>
        }
      </div>
    </div>
  `,
})
export class ChecklistPanelComponent {
  @Input({ required: true }) checklist!: Checklist;
  @Output() changed = new EventEmitter<void>();

  private checklistsSvc = inject(ChecklistsService);
  private toast = inject(ToastService);

  editingTitle = signal(false);
  titleDraft = '';
  editingItemId = signal<string | null>(null);
  itemDraft = '';
  adding = signal(false);
  newItemText = '';

  items(): ChecklistItem[] {
    return [...(this.checklist.items ?? [])].sort((a, b) => a.position - b.position);
  }

  get percent(): number {
    const list = this.checklist.items ?? [];
    if (!list.length) return 0;
    return Math.round((list.filter((i) => i.done).length / list.length) * 100);
  }

  startEditTitle() {
    this.titleDraft = this.checklist.title;
    this.editingTitle.set(true);
  }

  async saveTitle() {
    const title = this.titleDraft.trim();
    this.editingTitle.set(false);
    if (!title || title === this.checklist.title) return;
    try {
      await this.checklistsSvc.rename(this.checklist.id, title);
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo renombrar el checklist');
    }
  }

  async remove() {
    try {
      await this.checklistsSvc.delete(this.checklist.id);
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo eliminar el checklist');
    }
  }

  async toggle(item: ChecklistItem) {
    try {
      await this.checklistsSvc.toggleItem(item.id, !item.done);
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo actualizar el elemento');
    }
  }

  startEditItem(item: ChecklistItem) {
    this.itemDraft = item.text;
    this.editingItemId.set(item.id);
  }

  async saveItem(item: ChecklistItem) {
    const text = this.itemDraft.trim();
    this.editingItemId.set(null);
    if (!text || text === item.text) return;
    try {
      await this.checklistsSvc.updateItem(item.id, text);
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo actualizar el elemento');
    }
  }

  async removeItem(item: ChecklistItem) {
    try {
      await this.checklistsSvc.deleteItem(item.id);
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo eliminar el elemento');
    }
  }

  cancelAdd() {
    this.newItemText = '';
    this.adding.set(false);
  }

  async addItem() {
    const text = this.newItemText.trim();
    if (!text) return;
    const existing = this.checklist.items ?? [];
    const maxPos = existing.length ? Math.max(...existing.map((i) => i.position)) : 0;
    try {
      await this.checklistsSvc.addItem(this.checklist.id, text, maxPos + 1000);
      this.newItemText = '';
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('No se pudo agregar el elemento');
    }
  }
}
