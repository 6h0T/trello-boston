import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#1d3969] text-white hover:bg-[#24467f] shadow-sm',
  secondary: 'bg-white text-[#1d3969] border border-[#e2e8f0] hover:bg-slate-50',
  ghost: 'bg-transparent hover:bg-black/5 text-slate-700',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-[#059669] text-white hover:bg-emerald-700 shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 p-0 justify-center',
};

@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type"
      [disabled]="disabled"
      [class]="classes"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [':host{display:inline-flex}'],
})
export class ButtonComponent {
  @Input() variant: Variant = 'primary';
  @Input() size: Size = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: booleanAttribute }) block = false;

  get classes(): string {
    return [
      'inline-flex items-center justify-center rounded-md font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1',
      'disabled:opacity-50 disabled:pointer-events-none select-none',
      VARIANTS[this.variant],
      SIZES[this.size],
      this.block ? 'w-full' : '',
    ].join(' ');
  }
}
