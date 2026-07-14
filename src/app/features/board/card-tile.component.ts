import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Card } from '../../core/models/models';
import { formatDue, isOverdue, isDueSoon } from '../../core/util/date';
import { isLightColor } from '../../core/util/color';
import { AvatarComponent, BadgeComponent, IconComponent } from '../../shared/ui';

/**
 * Tarjeta compacta mostrada dentro de una columna.
 * Solo expone labels + members (las cards del board no traen checklists/comments).
 * Navega al detalle como ruta hija al hacer click.
 */
@Component({
  selector: 'app-card-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, RouterLink, AvatarComponent, BadgeComponent, IconComponent],
  template: `
    <a
      [routerLink]="['/board', card.board_id, 'card', card.id]"
      class="block bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:ring-2 hover:ring-[#2563eb]/40 p-2 mb-2 cursor-pointer transition-shadow"
      [style.backgroundColor]="isFullCover ? card.cover_color : null"
    >
      @if (card.cover_color && !isFullCover) {
        <div
          class="h-2 -mt-2 -mx-2 mb-2 rounded-t"
          [style.backgroundColor]="card.cover_color"
        ></div>
      }

      @if (card.labels?.length) {
        <div class="flex flex-wrap gap-1 mb-1.5">
          @for (l of card.labels; track l.id) {
            <app-badge [color]="l.color" [compact]="true" />
          }
        </div>
      }

      <p class="text-sm break-words" [ngClass]="titleClass">{{ card.title }}</p>

      @if (card.progress && card.progress > 0) {
        <div class="flex items-center gap-1.5 mt-1.5">
          <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              [style.width.%]="card.progress"
              [style.backgroundColor]="card.progress === 100 ? '#059669' : '#2563eb'"
            ></div>
          </div>
          <span class="text-[10px] leading-none text-slate-500 tabular-nums">{{ card.progress }}%</span>
        </div>
      }

      <div class="flex items-center justify-between text-xs text-slate-500 mt-1.5">
        <div class="flex items-center">
          @if (card.due_date) {
            <span
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 leading-none"
              [ngClass]="dueClass"
            >
              <app-icon name="calendar" [size]="12" />
              {{ formatDue(card.due_date) }}
            </span>
          }
        </div>
        <div class="flex items-center">
          @for (m of card.members; track m.id) {
            <span class="-ml-1.5 first:ml-0">
              <app-avatar [member]="m" [size]="22" />
            </span>
          }
        </div>
      </div>
    </a>
  `,
})
export class CardTileComponent {
  @Input({ required: true }) card!: Card;

  formatDue = formatDue;

  get isFullCover(): boolean {
    return !!this.card.cover_color && this.card.cover_size === 'full';
  }

  get titleClass(): string {
    if (!this.isFullCover) return 'text-slate-800 dark:text-slate-100';
    return isLightColor(this.card.cover_color)
      ? 'text-slate-900 font-medium'
      : 'text-white font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]';
  }

  get dueClass(): string {
    const c = this.card;
    if (c.due_complete) return 'bg-emerald-100 text-emerald-700';
    if (isOverdue(c.due_date, c.due_complete)) return 'bg-red-100 text-red-700';
    if (isDueSoon(c.due_date, c.due_complete)) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  }
}
