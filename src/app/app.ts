import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { NavbarComponent } from './shared/layout/navbar.component';
import { ToastContainerComponent } from './shared/ui/toast-container.component';
import { ConfirmDialogComponent } from './core/confirm/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, ToastContainerComponent, ConfirmDialogComponent],
  template: `
    <div class="flex h-screen flex-col">
      @if (auth.isAuthenticated()) {
        <app-navbar />
      }
      <main class="min-h-0 flex-1 overflow-auto">
        <router-outlet />
      </main>
    </div>
    <app-toast-container />
    <app-confirm-dialog />
  `,
})
export class App {
  protected auth = inject(AuthService);
}
