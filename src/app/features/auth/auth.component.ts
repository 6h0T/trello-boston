import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { ButtonComponent, IconComponent, SpinnerComponent } from '../../shared/ui';

@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <div class="min-h-full w-full bg-board-navy flex items-center justify-center p-4">
      <div class="w-full max-w-md rounded-2xl bg-white shadow-modal p-8 animate-scale-in">
        <!-- Marca -->
        <div class="mb-6 flex items-center gap-2">
          <span class="grid h-10 w-10 place-items-center rounded-lg bg-[#1d3969] text-white">
            <app-icon name="layout" [size]="20" />
          </span>
          <div>
            <h1 class="text-lg font-bold tracking-tight text-[#1d3969]">Boston Boards</h1>
            <p class="text-xs text-slate-500">Tablero colaborativo</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            class="rounded-md py-2 transition-colors"
            [ngClass]="mode() === 'login' ? 'bg-white shadow-sm text-[#1d3969]' : 'text-slate-500'"
            (click)="setMode('login')"
          >
            Iniciar sesión
          </button>
          <button
            class="rounded-md py-2 transition-colors"
            [ngClass]="mode() === 'register' ? 'bg-white shadow-sm text-[#1d3969]' : 'text-slate-500'"
            (click)="setMode('register')"
          >
            Crear cuenta
          </button>
        </div>

        <form (submit)="submit($event)" class="space-y-4">
          @if (mode() === 'register') {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
              <input
                name="name"
                [(ngModel)]="name"
                required
                autocomplete="name"
                placeholder="Elio Laurencio"
                class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
              />
            </div>
          }

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              type="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
              placeholder="tu@bostonam.com"
              class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
            <input
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              minlength="6"
              [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
              placeholder="••••••••"
              class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
            />
            @if (mode() === 'register') {
              <p class="mt-1 text-xs text-slate-400">Mínimo 6 caracteres.</p>
            }
          </div>

          <app-button type="submit" variant="primary" size="lg" [block]="true" [disabled]="loading()">
            @if (loading()) { <app-spinner [size]="18" /> }
            {{ mode() === 'login' ? 'Entrar' : 'Crear cuenta' }}
          </app-button>
        </form>

        <p class="mt-4 text-center text-xs text-slate-400">
          {{ mode() === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?' }}
          <button class="font-medium text-[#2563eb] hover:underline" (click)="toggle()">
            {{ mode() === 'login' ? 'Crear una' : 'Iniciar sesión' }}
          </button>
        </p>
      </div>
    </div>
  `,
})
export class AuthComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);

  name = '';
  email = '';
  password = '';

  setMode(m: 'login' | 'register') {
    this.mode.set(m);
  }

  toggle() {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
  }

  async submit(ev: Event) {
    ev.preventDefault();
    if (this.loading()) return;
    const email = this.email.trim();
    const password = this.password;
    if (!email || password.length < 6) {
      this.toast.error('Revisa tu email y una contraseña de al menos 6 caracteres.');
      return;
    }
    this.loading.set(true);
    try {
      if (this.mode() === 'login') {
        await this.auth.signIn(email, password);
        this.toast.success('¡Bienvenido!');
        this.router.navigateByUrl('/boards');
      } else {
        const name = this.name.trim() || email.split('@')[0];
        const { needsConfirmation } = await this.auth.signUp(email, password, name);
        if (needsConfirmation) {
          this.toast.info('Cuenta creada. Revisa tu email para confirmarla antes de entrar.');
          this.mode.set('login');
        } else {
          this.toast.success('¡Cuenta creada!');
          this.router.navigateByUrl('/boards');
        }
      }
    } catch (e: any) {
      this.toast.error(this.humanize(e?.message ?? 'Error de autenticación'));
    } finally {
      this.loading.set(false);
    }
  }

  private humanize(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (m.includes('already registered') || m.includes('already been registered'))
      return 'Ese email ya está registrado. Inicia sesión.';
    if (m.includes('password')) return 'La contraseña no cumple los requisitos (mín. 6).';
    return msg;
  }
}
