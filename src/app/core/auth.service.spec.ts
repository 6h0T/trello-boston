import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AUTH_STORAGE_KEY, SupabaseService } from './supabase.service';

/**
 * Regresión de la pantalla blanca en producción: con Supabase inaccesible
 * (fetch colgado), el bootstrap y el logout deben resolver igualmente.
 */
describe('AuthService sin conexión a Supabase', () => {
  const never = new Promise<never>(() => {});
  let sbMock: {
    client: { auth: Record<string, jasmine.Spy> };
  };
  let service: AuthService;

  beforeEach(() => {
    sbMock = {
      client: {
        auth: {
          getSession: jasmine.createSpy('getSession').and.returnValue(never),
          onAuthStateChange: jasmine.createSpy('onAuthStateChange').and.returnValue({
            data: { subscription: { unsubscribe: () => {} } },
          }),
          signOut: jasmine.createSpy('signOut').and.returnValue(never),
        },
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: sbMock }],
    });
    service = TestBed.inject(AuthService);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  });

  it('init() resuelve como sesión nula si getSession nunca responde', fakeAsync(() => {
    let resolved = false;
    void service.init().then(() => (resolved = true));

    tick(4999);
    expect(resolved).toBeFalse();

    tick(1);
    expect(resolved).toBeTrue();
    expect(service.session()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  }));

  it('signOut() limpia la sesión local aunque el servidor nunca responda', fakeAsync(() => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{"fake":"session"}');

    let resolved = false;
    void service.signOut().then(() => (resolved = true));

    tick(4000);
    expect(resolved).toBeTrue();
    expect(service.session()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  }));
});
