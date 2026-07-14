import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AvatarComponent,
  BadgeComponent,
  IconComponent,
  SpinnerComponent,
} from '../../shared/ui';
import { EmptyStateComponent } from '../../shared/ui/extras';
import { Card, boardBgClass } from '../../core/models/models';
import { CurrentUserStore } from '../../core/current-user.store';
import { CardsService } from '../../core/services/cards.service';
import { ToastService } from '../../core/toast.service';
import { formatDue, isOverdue } from '../../core/util/date';

/** Resumen de un tablero asociado a una tarjeta asignada. */
interface BoardRef {
  id: string;
  title: string;
  background: string;
}

/** Tarjetas agrupadas por tablero para el render. */
interface BoardGroup {
  board: BoardRef;
  cards: Card[];
}

/**
 * Vista "Mis tarjetas": todo lo que el usuario actual tiene asignado / del que
 * es responsable, en todos los tableros. Es la vista que expande las
 * responsabilidades de un perfil.
 *
 * Ruta: '/my-cards'
 */
@Component({
  selector: 'app-my-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    BadgeComponent,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <section class="mx-auto min-h-full max-w-4xl bg-background px-6 py-8">
      <!-- Cabecera -->
      <header class="mb-8 flex items-start gap-4">
        <app-avatar [member]="currentUser.current()" [size]="48" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Mis tarjetas
            </h1>
            @if (!loading()) {
              <span
                class="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-navy/10 px-2 text-sm font-semibold text-brand-navy"
                [attr.aria-label]="total() + ' tarjetas'"
              >
                {{ total() }}
              </span>
            }
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Tarjetas donde eres responsable
          </p>
        </div>
      </header>

      <!-- Estado de carga -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <app-spinner [size]="36" />
          <span class="text-sm">Cargando tus tarjetas…</span>
        </div>
      } @else if (total() === 0) {
        <!-- Estado vacío -->
        <app-empty-state
          icon="check-square"
          title="No tienes tarjetas asignadas"
          subtitle="Cuando te asignen como responsable de una tarjeta, aparecerá aquí."
        />
      } @else {
        <!-- Grupos por tablero -->
        <div class="space-y-8">
          @for (group of groups(); track group.board.id) {
            <div>
              <!-- Encabezado del tablero -->
              <div class="mb-3 flex items-center gap-2">
                <span
                  [class]="bgClass(group.board.background)"
                  class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold text-white shadow-sm"
                >
                  <app-icon name="layout" [size]="14" />
                  {{ group.board.title }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ group.cards.length }}
                  {{ group.cards.length === 1 ? 'tarjeta' : 'tarjetas' }}
                </span>
              </div>

              <!-- Lista de tarjetas del tablero -->
              <ul class="space-y-2">
                @for (card of group.cards; track card.id) {
                  <li>
                    <button
                      type="button"
                      class="group w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-brand-accent/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                      (click)="openCard(card)"
                    >
                      <!-- Etiquetas -->
                      @if (card.labels?.length) {
                        <div class="mb-2 flex flex-wrap items-center gap-1">
                          @for (label of card.labels; track label.id) {
                            <app-badge [color]="label.color" [compact]="true" />
                          }
                        </div>
                      }

                      <!-- Título -->
                      <h3 class="text-sm font-medium text-card-foreground group-hover:text-brand-accent">
                        {{ card.title }}
                      </h3>

                      <!-- Chip de fecha -->
                      @if (card.due_date) {
                        <div class="mt-2">
                          <span
                            class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                            [class.bg-rose-100]="isOverdue(card.due_date, card.due_complete)"
                            [class.text-rose-700]="isOverdue(card.due_date, card.due_complete)"
                            [class.bg-emerald-100]="card.due_complete"
                            [class.text-emerald-700]="card.due_complete"
                            [class.bg-slate-100]="!card.due_complete && !isOverdue(card.due_date, card.due_complete)"
                            [class.text-slate-600]="!card.due_complete && !isOverdue(card.due_date, card.due_complete)"
                          >
                            <app-icon
                              [name]="card.due_complete ? 'check' : 'clock'"
                              [size]="12"
                            />
                            {{ formatDue(card.due_date) }}
                          </span>
                        </div>
                      }

                      <!-- Barra de progreso -->
                      <div class="mt-3 flex items-center gap-2">
                        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            class="h-1.5 rounded-full transition-[width]"
                            [class.bg-emerald-500]="(card.progress || 0) >= 100"
                            [class.bg-brand-accent]="(card.progress || 0) < 100"
                            [style.width.%]="card.progress || 0"
                          ></div>
                        </div>
                        <span class="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {{ card.progress || 0 }}%
                        </span>
                      </div>
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class MyCardsComponent {
  readonly currentUser = inject(CurrentUserStore);
  private cardsService = inject(CardsService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // Helpers de plantilla
  readonly formatDue = formatDue;
  readonly isOverdue = isOverdue;
  readonly bgClass = boardBgClass;

  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);

  readonly total = computed(() => this.cards().length);

  /** Agrupa las tarjetas por tablero, preservando el orden de llegada. */
  readonly groups = computed<BoardGroup[]>(() => {
    const out: BoardGroup[] = [];
    const byId = new Map<string, BoardGroup>();

    for (const card of this.cards()) {
      const board = (card as any).board as BoardRef | undefined;
      const id = board?.id ?? card.board_id ?? 'sin-tablero';
      let group = byId.get(id);
      if (!group) {
        group = {
          board: board ?? { id, title: 'Sin tablero', background: 'navy' },
          cards: [],
        };
        byId.set(id, group);
        out.push(group);
      }
      group.cards.push(card);
    }

    return out;
  });

  constructor() {
    // Recarga cuando cambia el usuario actual (cambio de perfil).
    effect(() => {
      const id = this.currentUser.currentId();
      this.load(id);
    });
  }

  private async load(memberId: string | null): Promise<void> {
    if (!memberId) {
      this.cards.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const data = await this.cardsService.listAssignedTo(memberId);
      this.cards.set(data);
    } catch {
      this.cards.set([]);
      this.toast.error('No se pudieron cargar tus tarjetas.');
    } finally {
      this.loading.set(false);
    }
  }

  openCard(card: Card): void {
    const boardId = (card as any).board?.id || card.board_id;
    this.router.navigate(['/board', boardId, 'card', card.id]);
  }
}
