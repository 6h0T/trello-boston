import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
}

const CLOSED_STATE: ConfirmState = {
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  danger: false,
};

/**
 * Diálogo de confirmación global basado en promesas.
 *
 * @example
 * const ok = await this.confirm.confirm({
 *   title: 'Eliminar tablero',
 *   message: 'Esta acción no se puede deshacer.',
 *   danger: true,
 * });
 * if (ok) { ... }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _state = signal<ConfirmState>(CLOSED_STATE);
  readonly state = this._state.asReadonly();

  private resolver: ((value: boolean) => void) | null = null;

  /** Abre el diálogo y resuelve `true` al aceptar o `false` al cancelar. */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    // Si hubiera un diálogo previo sin resolver, lo cancelamos.
    this.resolver?.(false);

    this._state.set({
      open: true,
      title: opts.title,
      message: opts.message ?? '',
      confirmText: opts.confirmText ?? 'Confirmar',
      danger: opts.danger ?? false,
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  /** Resuelve la promesa con `true` y cierra el diálogo. */
  accept(): void {
    this.settle(true);
  }

  /** Resuelve la promesa con `false` y cierra el diálogo. */
  cancel(): void {
    this.settle(false);
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this._state.set(CLOSED_STATE);
    resolve?.(result);
  }
}
