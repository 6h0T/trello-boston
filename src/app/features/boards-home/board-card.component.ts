import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AvatarComponent,
  IconComponent,
  PopoverComponent,
} from '../../shared/ui';
import { Board, boardBgClass } from '../../core/models/models';

/**
 * Tarjeta individual de un tablero en el dashboard.
 * Es "tonta": emite eventos hacia el contenedor, que ejecuta la lógica
 * sobre BoardsService y refresca el signal local.
 */
@Component({
  selector: 'app-board-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, IconComponent, PopoverComponent],
  template: `
    <a
      [routerLink]="['/board', board.id]"
      [class]="bgClass"
      class="group relative flex h-28 flex-col justify-between overflow-hidden rounded-lg bg-cover bg-center p-3 shadow-card transition hover:shadow-card-hover cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      [style.background-image]="bgImage"
    >
      <!-- Capa de oscurecido al hacer hover para legibilidad -->
      <span
        class="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10"
      ></span>

      <!-- Fila superior: título + acciones -->
      <div class="relative flex items-start justify-between gap-2">
        <h3
          class="line-clamp-2 pr-1 text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        >
          {{ board.title }}
        </h3>

        <div class="flex items-center gap-0.5">
          <!-- Estrella -->
          <button
            type="button"
            class="grid h-7 w-7 place-items-center rounded-md text-white/90 transition hover:bg-white/20"
            [attr.aria-label]="board.starred ? 'Quitar de destacados' : 'Marcar como destacado'"
            [attr.aria-pressed]="board.starred"
            (click)="onStar($event)"
          >
            <app-icon
              name="star"
              [size]="16"
              [class.text-amber-400]="board.starred"
              [class.text-white]="!board.starred"
            />
          </button>

          <!-- Menú de opciones -->
          <app-popover #menu="popover" align="end">
            <button
              trigger
              type="button"
              class="grid h-7 w-7 place-items-center rounded-md text-white/90 transition hover:bg-white/20"
              aria-label="Más opciones"
              (click)="$event.preventDefault()"
            >
              <app-icon name="more-horizontal" [size]="16" />
            </button>

            <div panel class="w-48 p-1 text-sm text-card-foreground">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted"
                (click)="onMenu($event, 'rename', menu)"
              >
                <app-icon name="pencil" [size]="15" /> Renombrar
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted"
                (click)="onMenu($event, 'background', menu)"
              >
                <app-icon name="layout" [size]="15" /> Cambiar fondo
              </button>
              <div class="my-1 h-px bg-border"></div>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-destructive hover:bg-destructive/10"
                (click)="onMenu($event, 'delete', menu)"
              >
                <app-icon name="trash" [size]="15" /> Eliminar
              </button>
            </div>
          </app-popover>
        </div>
      </div>

      <!-- Fila inferior: avatares de miembros -->
      <div class="relative flex items-center">
        @for (m of (board.members ?? []).slice(0, 5); track m.id) {
          <span class="-ml-2 first:ml-0">
            <app-avatar [member]="m" [size]="22" />
          </span>
        }
        @if ((board.members?.length ?? 0) > 5) {
          <span
            class="-ml-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-black/40 text-[10px] font-semibold text-white ring-2 ring-white"
          >
            +{{ (board.members!.length - 5) }}
          </span>
        }
      </div>
    </a>
  `,
})
export class BoardCardComponent {
  @Input({ required: true }) board!: Board;

  @Output() toggleStar = new EventEmitter<Board>();
  @Output() rename = new EventEmitter<Board>();
  @Output() changeBackground = new EventEmitter<Board>();
  @Output() remove = new EventEmitter<Board>();

  get bgClass(): string {
    return boardBgClass(this.board.background);
  }

  get bgImage(): string | null {
    const url = this.board.background_image_url;
    return url ? `url("${url}")` : null;
  }

  onStar(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    this.toggleStar.emit(this.board);
  }

  onMenu(ev: Event, action: 'rename' | 'background' | 'delete', menu: PopoverComponent) {
    ev.preventDefault();
    ev.stopPropagation();
    menu.close();
    if (action === 'rename') this.rename.emit(this.board);
    else if (action === 'background') this.changeBackground.emit(this.board);
    else this.remove.emit(this.board);
  }
}
