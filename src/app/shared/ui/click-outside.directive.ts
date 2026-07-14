import { Directive, ElementRef, EventEmitter, HostListener, Output, inject } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  private el = inject(ElementRef<HTMLElement>);
  @Output() appClickOutside = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  onClick(ev: MouseEvent) {
    if (!this.el.nativeElement.contains(ev.target)) {
      this.appClickOutside.emit();
    }
  }
}
