import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '../icon.component';

/**
 * Bloque centrado para estados vacíos (sin tableros, sin tarjetas, etc.).
 * Proyecta `<ng-content>` para acciones (p. ej. un botón de "Crear").
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        class="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-[#1d3969] dark:bg-slate-800 dark:text-slate-300"
      >
        <app-icon [name]="icon" [size]="32" [strokeWidth]="1.5" />
      </div>

      @if (title) {
        <h3 class="mt-5 text-base font-semibold text-[#1d3969] dark:text-slate-100">
          {{ title }}
        </h3>
      }

      @if (subtitle) {
        <p class="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {{ subtitle }}
        </p>
      }

      <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = '';
  @Input() subtitle = '';
}
