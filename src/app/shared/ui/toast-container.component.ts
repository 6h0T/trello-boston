import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-modal animate-slide-up min-w-[16rem]"
          [class.bg-emerald-600]="t.type === 'success'"
          [class.bg-red-600]="t.type === 'error'"
          [class.bg-slate-800]="t.type === 'info'"
        >
          <span class="flex-1">{{ t.message }}</span>
          <button (click)="toasts.dismiss(t.id)" class="opacity-80 hover:opacity-100">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  toasts = inject(ToastService);
}
