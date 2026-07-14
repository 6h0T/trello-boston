import { Injectable, computed, signal } from '@angular/core';
import { boardNavColor } from './models/models';

/**
 * App "chrome" state shared between the board view and the app shell (navbar).
 * The board view sets the active board background so the navbar can tint itself
 * to match; it clears it on leave so other pages get the default navy.
 */
@Injectable({ providedIn: 'root' })
export class ChromeService {
  /** Active board background key (e.g. 'navy', 'teal'); null on non-board pages. */
  readonly background = signal<string | null>(null);

  /** Solid color for the navbar matching the current board (default navy). */
  readonly navColor = computed(() => boardNavColor(this.background()));

  setBackground(bg: string | null) {
    this.background.set(bg);
  }

  clear() {
    this.background.set(null);
  }
}
