import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  booleanAttribute,
  inject,
  signal,
} from '@angular/core';

/**
 * Lightweight popover. Usage:
 *   <app-popover #p="popover" align="start">
 *     <button trigger>Open</button>
 *     <div panel>...content...  (call p.close() after an action)</div>
 *   </app-popover>
 */
@Component({
  selector: 'app-popover',
  standalone: true,
  exportAs: 'popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [class.inline-flex]="!block" [class.w-full]="block">
      <div (click)="toggle($event)" class="inline-flex" [class.w-full]="block">
        <ng-content select="[trigger]"></ng-content>
      </div>
      @if (open()) {
        <div
          class="absolute top-full z-50 mt-2 min-w-[16rem] rounded-lg border border-border bg-popover text-popover-foreground shadow-modal animate-slide-up"
          [class.left-0]="align === 'start'"
          [class.right-0]="align === 'end'"
          (click)="$event.stopPropagation()"
        >
          <ng-content select="[panel]"></ng-content>
        </div>
      }
    </div>
  `,
})
export class PopoverComponent {
  private host = inject(ElementRef<HTMLElement>);
  @Input() align: 'start' | 'end' = 'start';
  /** Full-width mode for stacked menus (e.g. card-detail sidebar). */
  @Input({ transform: booleanAttribute }) block = false;
  readonly open = signal(false);

  @HostBinding('class.block') get hostBlock() {
    return this.block;
  }

  toggle(ev: Event) {
    ev.stopPropagation();
    this.open.update((v) => !v);
  }

  close() {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(ev.target)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close();
  }
}
