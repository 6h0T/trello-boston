import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { ButtonComponent, IconComponent } from '../../shared/ui';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { ActivityService } from '../../core/services/activity.service';
import { BoardStore } from '../../core/board.store';
import { Activity } from '../../core/models/models';
import { relativeTime } from '../../core/util/date';

/**
 * Sliding activity feed for the board (anchored to the right edge, below the
 * top bar). Loads the latest activity whenever it becomes visible.
 */
@Component({
  selector: 'app-activity-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, AvatarComponent],
  template: `
    @if (open) {
      <aside
        class="fixed bottom-0 right-0 top-14 z-40 flex w-80 flex-col border-l border-border bg-card text-card-foreground shadow-modal animate-slide-up"
        role="complementary"
        aria-label="Actividad del tablero"
      >
        <!-- Cabecera -->
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div class="flex items-center gap-2">
            <app-icon name="activity" [size]="18" />
            <h2 class="text-sm font-semibold text-foreground">Actividad</h2>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            aria-label="Cerrar actividad"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <!-- Lista -->
        <div class="flex-1 overflow-y-auto px-3 py-3">
          @if (loading()) {
            <p class="px-1 py-2 text-sm text-muted-foreground">Cargando actividad…</p>
          } @else if (items().length === 0) {
            <p class="px-1 py-2 text-sm text-muted-foreground">Aún no hay actividad.</p>
          } @else {
            <ul class="space-y-3">
              @for (a of items(); track a.id) {
                <li class="flex items-start gap-2.5">
                  <app-avatar [member]="a.member" [size]="28" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm leading-snug text-foreground">
                      <span class="font-semibold">{{ a.member?.name || 'Alguien' }}</span>
                      {{ ' ' }}{{ describe(a) }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">{{ rel(a.created_at) }}</p>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <!-- Pie -->
        <footer class="border-t border-border px-3 py-2">
          <app-button variant="ghost" size="sm" block (click)="load()">
            <app-icon name="clock" [size]="15" />
            <span>Actualizar</span>
          </app-button>
        </footer>
      </aside>
    }
  `,
})
export class ActivitySidebarComponent implements OnChanges {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  private activitySvc = inject(ActivityService);
  private store = inject(BoardStore);

  readonly items = signal<Activity[]>([]);
  readonly loading = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange && openChange.currentValue && !openChange.previousValue) {
      this.load();
    }
  }

  async load(): Promise<void> {
    const board = this.store.board();
    if (!board) return;
    this.loading.set(true);
    try {
      const data = await this.activitySvc.listByBoard(board.id, 50);
      this.items.set(data ?? []);
    } catch {
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  rel(iso: string | null | undefined): string {
    return relativeTime(iso);
  }

  /** Human-readable Spanish phrase for an activity entry. */
  describe(a: Activity): string {
    const title = a.data?.['title'];
    switch (a.type) {
      case 'card.created':
        return title ? `creó la tarjeta «${title}»` : 'creó una tarjeta';
      case 'card.completed':
        return title ? `completó «${title}»` : 'completó una tarjeta';
      case 'card.updated':
        return title ? `actualizó «${title}»` : 'actualizó una tarjeta';
      case 'card.moved':
        return 'movió una tarjeta';
      case 'card.archived':
        return title ? `archivó «${title}»` : 'archivó una tarjeta';
      case 'comment.added':
        return 'comentó en una tarjeta';
      case 'list.created':
        return title ? `creó la lista «${title}»` : 'creó una lista';
      case 'member.added':
        return 'se unió al tablero';
      default:
        return a.type;
    }
  }
}
