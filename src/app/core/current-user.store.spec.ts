import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from './current-user.store';
import { Member } from './models/models';

const member = (over: Partial<Member>): Member => ({
  id: 'm1',
  name: 'Test',
  color: '#000',
  ...over,
});

describe('CurrentUserStore', () => {
  let store: CurrentUserStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CurrentUserStore);
  });

  it('isAdmin es false sin usuario o con rol empleado', () => {
    expect(store.isAdmin()).toBeFalse();
    store.setCurrentMember(member({ role: 'empleado' }));
    expect(store.isAdmin()).toBeFalse();
  });

  it('isAdmin es true con rol admin', () => {
    store.setCurrentMember(member({ role: 'admin' }));
    expect(store.isAdmin()).toBeTrue();
  });

  it('updateMember actualiza el roster y el usuario actual', () => {
    store.setCurrentMember(member({ id: 'm1', role: 'empleado' }));
    store.setMembers([member({ id: 'm1', role: 'empleado' }), member({ id: 'm2' })]);
    store.updateMember(member({ id: 'm1', role: 'admin' }));
    expect(store.isAdmin()).toBeTrue();
    expect(store.members().find((m) => m.id === 'm1')?.role).toBe('admin');
  });
});
