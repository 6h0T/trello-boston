import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { ConfirmService } from './confirm.service';

/**
 * Host visual del {@link ConfirmService}. Se monta una sola vez en el shell
 * de la app; reacciona al estado del servicio para mostrar el diálogo.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="svc.state().open" width="max-w-sm" (closed)="svc.cancel()">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-[#1d3969] dark:text-slate-100">
          {{ svc.state().title }}
        </h2>

        @if (svc.state().message) {
          <p class="mt-2 text-sm text-muted-foreground">
            {{ svc.state().message }}
          </p>
        }

        <div class="mt-6 flex justify-end gap-2">
          <app-button variant="secondary" (click)="svc.cancel()">
            Cancelar
          </app-button>
          <app-button
            [variant]="svc.state().danger ? 'danger' : 'primary'"
            (click)="svc.accept()"
          >
            {{ svc.state().confirmText }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly svc = inject(ConfirmService);
}
