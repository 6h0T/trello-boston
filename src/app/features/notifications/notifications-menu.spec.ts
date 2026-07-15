import { TestBed } from '@angular/core/testing';
import { NotificationsMenuComponent } from './notifications-menu.component';
import { Notification } from '../../core/models/models';

const notif = (over: Partial<Notification>): Notification =>
  ({
    id: 'n1',
    member_id: 'm1',
    actor: { id: 'a1', name: 'Ana', color: '#000' },
    type: 'card.commented',
    read: false,
    data: { title: 'Tarea X' },
    ...over,
  }) as Notification;

describe('NotificationsMenuComponent.textFor', () => {
  let component: NotificationsMenuComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotificationsMenuComponent] });
    component = TestBed.createComponent(NotificationsMenuComponent).componentInstance;
  });

  it('describe un movimiento de lista', () => {
    const n = notif({ type: 'card.moved', data: { title: 'Tarea X', from_list: 'Por hacer', to_list: 'Hecho' } });
    expect(component.textFor(n)).toBe('Ana movió «Tarea X» a Hecho');
  });

  it('describe cambios de campo', () => {
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'title' } })))
      .toBe('Ana cambió el título de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'description' } })))
      .toBe('Ana actualizó la descripción de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'due_date' } })))
      .toBe('Ana cambió la fecha límite de «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'archived', archived: true } })))
      .toBe('Ana archivó «T»');
    expect(component.textFor(notif({ type: 'card.updated', data: { title: 'T', field: 'archived', archived: false } })))
      .toBe('Ana restauró «T»');
  });
});
