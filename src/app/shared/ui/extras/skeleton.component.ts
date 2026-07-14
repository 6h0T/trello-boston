import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Placeholder de carga con animación de pulso. Configurable por dimensiones.
 *
 * @example
 * <app-skeleton width="60%" height="1.25rem" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="animate-pulse bg-slate-200 dark:bg-slate-700"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="rounded"
    ></div>
  `,
  styles: [':host{display:block}'],
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '1rem';
  @Input() rounded = '0.375rem';
}
