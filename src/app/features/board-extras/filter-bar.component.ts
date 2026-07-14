import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ButtonComponent, IconComponent, PopoverComponent } from '../../shared/ui';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { FilterService, DueFilter } from '../../core/filter.service';
import { BoardStore } from '../../core/board.store';

interface DueOption {
  value: DueFilter;
  label: string;
}

/**
 * Filter bar for the board view. Reads/writes the route-provided FilterService
 * so the board canvas reflects active filters instantly. Styled per the Boston
 * Asset Manager UI kit (navy/accent, rounded, dark-mode aware).
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, AvatarComponent, PopoverComponent, NgClass],
  template: `
    <app-popover #p="popover" align="end">
      <button trigger class="inline-flex">
        <app-button variant="secondary" size="sm">
          <app-icon name="filter" [size]="16" />
          <span>Filtros</span>
          @if (filter.active()) {
            <span
              class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#2563eb] px-1.5 text-[11px] font-semibold text-white"
            >{{ activeCount() }}</span>
          }
        </app-button>
      </button>

      <div panel class="w-80 space-y-3 p-3">
        <!-- Buscar -->
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-muted-foreground">Buscar</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <app-icon name="search" [size]="15" />
            </span>
            <input
              type="text"
              placeholder="Buscar tarjetas…"
              [value]="filter.query()"
              (input)="filter.query.set($any($event.target).value)"
              class="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            />
          </div>
        </div>

        <!-- Miembros -->
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-muted-foreground">Miembros</label>
          @if (store.allMembers().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (m of store.allMembers(); track m.id) {
                <button
                  type="button"
                  (click)="filter.toggleMember(m.id)"
                  [attr.aria-pressed]="filter.memberIds().includes(m.id)"
                  class="inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-medium transition-colors"
                  [ngClass]="
                    filter.memberIds().includes(m.id)
                      ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#1d3969] ring-1 ring-[#2563eb]'
                      : 'border-transparent bg-muted text-foreground hover:bg-accent'
                  "
                >
                  <app-avatar [member]="m" [size]="20" />
                  <span class="max-w-[7rem] truncate">{{ m.name }}</span>
                </button>
              }
            </div>
          } @else {
            <p class="text-xs text-muted-foreground">Sin miembros en el tablero.</p>
          }
        </div>

        <!-- Etiquetas -->
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-muted-foreground">Etiquetas</label>
          @if (store.labels().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (l of store.labels(); track l.id) {
                <button
                  type="button"
                  (click)="filter.toggleLabel(l.id)"
                  [attr.aria-pressed]="filter.labelIds().includes(l.id)"
                  class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                  [ngClass]="
                    filter.labelIds().includes(l.id)
                      ? 'border-[#2563eb] bg-[#2563eb]/10 text-foreground ring-1 ring-[#2563eb]'
                      : 'border-transparent bg-muted text-foreground hover:bg-accent'
                  "
                >
                  <span class="h-3 w-3 shrink-0 rounded-sm" [style.backgroundColor]="l.color"></span>
                  <span class="max-w-[7rem] truncate">{{ l.name || 'Sin nombre' }}</span>
                </button>
              }
            </div>
          } @else {
            <p class="text-xs text-muted-foreground">Sin etiquetas en el tablero.</p>
          }
        </div>

        <!-- Fecha -->
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-muted-foreground">Fecha</label>
          <div class="flex flex-wrap gap-1.5">
            @for (opt of dueOptions; track opt.value) {
              <button
                type="button"
                (click)="filter.due.set(opt.value)"
                [attr.aria-pressed]="filter.due() === opt.value"
                class="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                [ngClass]="
                  filter.due() === opt.value
                    ? 'border-[#2563eb] bg-[#2563eb] text-white'
                    : 'border-transparent bg-muted text-foreground hover:bg-accent'
                "
              >{{ opt.label }}</button>
            }
          </div>
        </div>

        <!-- Limpiar -->
        <div class="border-t border-border pt-2">
          <app-button variant="ghost" size="sm" block (click)="filter.clear()">
            <app-icon name="x" [size]="15" />
            <span>Limpiar filtros</span>
          </app-button>
        </div>
      </div>
    </app-popover>
  `,
})
export class FilterBarComponent {
  readonly filter = inject(FilterService);
  readonly store = inject(BoardStore);

  readonly dueOptions: DueOption[] = [
    { value: 'any', label: 'Cualquiera' },
    { value: 'overdue', label: 'Vencidas' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'none', label: 'Sin fecha' },
    { value: 'complete', label: 'Completadas' },
  ];

  readonly activeCount = computed(() => {
    let n = 0;
    if (this.filter.query().trim().length > 0) n++;
    n += this.filter.memberIds().length;
    n += this.filter.labelIds().length;
    if (this.filter.due() !== 'any') n++;
    return n;
  });
}
