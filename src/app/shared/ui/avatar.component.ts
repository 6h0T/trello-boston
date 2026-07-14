import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Member } from '../../core/models/models';

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (member?.avatar_url) {
      <img
        [src]="member!.avatar_url"
        [alt]="member!.name"
        [style.width.px]="size"
        [style.height.px]="size"
        class="rounded-full object-cover ring-2 ring-white"
        [title]="member!.name"
      />
    } @else {
      <span
        class="inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white select-none"
        [style.width.px]="size"
        [style.height.px]="size"
        [style.fontSize.px]="size * 0.4"
        [style.backgroundColor]="member?.color || '#64748b'"
        [title]="member?.name || ''"
      >{{ initials }}</span>
    }
  `,
  styles: [':host{display:inline-flex}'],
})
export class AvatarComponent {
  @Input() member: Member | null | undefined;
  @Input() size = 32;

  get initials(): string {
    const n = (this.member?.name || '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
