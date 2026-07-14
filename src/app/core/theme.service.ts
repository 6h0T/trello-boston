import { Injectable, signal } from '@angular/core';

const KEY = 'tb_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(localStorage.getItem(KEY) === 'dark');

  constructor() {
    this.apply();
  }

  toggle() {
    this.dark.update((v) => !v);
    localStorage.setItem(KEY, this.dark() ? 'dark' : 'light');
    this.apply();
  }

  private apply() {
    const el = document.documentElement;
    if (this.dark()) el.classList.add('dark');
    else el.classList.remove('dark');
  }
}
