import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

/**
 * Controlled modal: parent owns `open` and listens to `(closed)`.
 * Closes on ESC and backdrop click.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8 animate-fade-in"
        (click)="close()"
      >
        <div
          class="relative my-4 w-full rounded-xl bg-card text-card-foreground shadow-modal animate-scale-in"
          [class]="width"
          (click)="$event.stopPropagation()"
        >
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() open = false;
  @Input() width = 'max-w-2xl';
  @Output() closed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open) this.close();
  }
}
