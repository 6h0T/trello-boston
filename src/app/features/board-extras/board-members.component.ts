import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent, IconComponent, PopoverComponent } from '../../shared/ui';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { BoardStore } from '../../core/board.store';
import { BoardsService } from '../../core/services/boards.service';
import { ToastService } from '../../core/toast.service';
import { CurrentUserStore } from '../../core/current-user.store';
import { Member } from '../../core/models/models';

/**
 * Stacked board-member avatars plus an "Invitar" popover to add/remove members.
 * Mutates membership via BoardsService and reloads the board record afterward.
 */
@Component({
  selector: 'app-board-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, AvatarComponent, PopoverComponent],
  template: `
    <div class="flex items-center gap-2">
      <!-- Avatares apilados -->
      @if (visibleMembers().length) {
        <div class="flex items-center pl-2">
          @for (m of visibleMembers(); track m.id) {
            <span class="-ml-2 first:ml-0">
              <app-avatar [member]="m" [size]="26" />
            </span>
          }
          @if (overflowCount() > 0) {
            <span
              class="-ml-2 inline-flex items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-white"
              [style.width.px]="26"
              [style.height.px]="26"
              [title]="overflowCount() + ' miembros más'"
            >+{{ overflowCount() }}</span>
          }
        </div>
      }

      <!-- Invitar -->
      <app-popover #p="popover" align="end">
        <button trigger class="inline-flex">
          <app-button variant="secondary" size="sm">
            <app-icon name="users" [size]="16" />
            <span>Compartir</span>
          </app-button>
        </button>

        <div panel class="w-72 p-2">
          <p class="px-1.5 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
            Miembros del tablero
          </p>
          @if (store.allMembers().length) {
            <ul class="max-h-72 space-y-0.5 overflow-y-auto">
              @for (m of store.allMembers(); track m.id) {
                <li class="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent">
                  <app-avatar [member]="m" [size]="28" />
                  <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{ m.name }}</span>
                  @if (isMember(m.id)) {
                    <app-button variant="ghost" size="sm" (click)="remove(m)">
                      <app-icon name="x" [size]="14" />
                      <span>Quitar</span>
                    </app-button>
                  } @else {
                    <app-button variant="secondary" size="sm" (click)="add(m)">
                      <app-icon name="plus" [size]="14" />
                      <span>Añadir</span>
                    </app-button>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="px-1.5 py-2 text-sm text-muted-foreground">No hay miembros disponibles.</p>
          }
        </div>
      </app-popover>
    </div>
  `,
})
export class BoardMembersComponent {
  readonly store = inject(BoardStore);
  private boards = inject(BoardsService);
  private toast = inject(ToastService);
  protected currentUser = inject(CurrentUserStore);

  private readonly members = computed<Member[]>(() => this.store.board()?.members ?? []);
  readonly visibleMembers = computed(() => this.members().slice(0, 5));
  readonly overflowCount = computed(() => Math.max(0, this.members().length - 5));

  isMember(id: string): boolean {
    return this.members().some((m) => m.id === id);
  }

  async add(m: Member): Promise<void> {
    const board = this.store.board();
    if (!board) return;
    try {
      await this.boards.addMember(board.id, m.id);
      await this.store.reloadBoard();
      this.toast.success(`Se añadió a ${m.name} al tablero`);
    } catch (e: any) {
      this.toast.error('No se pudo añadir el miembro: ' + (e?.message ?? e));
    }
  }

  async remove(m: Member): Promise<void> {
    const board = this.store.board();
    if (!board) return;
    try {
      await this.boards.removeMember(board.id, m.id);
      await this.store.reloadBoard();
      this.toast.success(`Se quitó a ${m.name} del tablero`);
    } catch (e: any) {
      this.toast.error('No se pudo quitar el miembro: ' + (e?.message ?? e));
    }
  }
}
