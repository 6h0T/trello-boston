import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Colored label chip (Trello-style). */
@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-md font-medium text-white leading-none"
      [class.px-2]="!compact"
      [class.py-1]="!compact"
      [class.text-xs]="!compact"
      [style.backgroundColor]="color"
      [style.height.px]="compact ? 8 : null"
      [style.width.px]="compact ? 36 : null"
      [style.minWidth.px]="compact ? 36 : null"
    >
      @if (!compact) { {{ label }} }
    </span>
  `,
  styles: [':host{display:inline-flex}'],
})
export class BadgeComponent {
  @Input() color = '#64748b';
  @Input() label = '';
  /** compact = just the color stripe shown on the card front */
  @Input() compact = false;
}
