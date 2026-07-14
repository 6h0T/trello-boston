import { Component, signal } from '@angular/core';
import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Card, List } from '../../core/models/models';
import { BoardStore } from '../../core/board.store';
import { FilterService } from '../../core/filter.service';
import { ListsService } from '../../core/services/lists.service';
import { CardsService } from '../../core/services/cards.service';
import { ActivityService } from '../../core/services/activity.service';
import { CurrentUserStore } from '../../core/current-user.store';
import { ToastService } from '../../core/toast.service';
import { ListColumnComponent } from './list-column.component';

const LIST_A: List = { id: 'list-a', board_id: 'b1', title: 'Por hacer', position: 1000, archived: false };
const LIST_B: List = { id: 'list-b', board_id: 'b1', title: 'En progreso', position: 2000, archived: false };
const CARD: Card = {
  id: 'card-1',
  list_id: 'list-a',
  board_id: 'b1',
  title: 'Tarjeta de prueba',
  position: 1000,
  due_complete: false,
  archived: false,
  labels: [],
  members: [],
};

class FakeBoardStore {
  private _cards = signal<Card[]>([{ ...CARD }]);
  lists = signal<List[]>([LIST_A, LIST_B]);
  cardsForList(listId: string): Card[] {
    return this._cards()
      .filter((c) => c.list_id === listId && !c.archived)
      .sort((a, b) => a.position - b.position);
  }
  moveCard = jasmine
    .createSpy('moveCard')
    .and.callFake(async (cardId: string, toListId: string) => {
      this._cards.update((cs) =>
        cs.map((c) => (c.id === cardId ? { ...c, list_id: toListId } : c)),
      );
    });
  reload = jasmine.createSpy('reload').and.resolveTo(undefined);
  nextCardPosition(): number {
    return 2000;
  }
}

/**
 * Réplica 1:1 del canvas de board-view.component.ts (drop list horizontal de
 * columnas + columnas cdkDrag) con estilos inline que imitan la geometría de
 * Tailwind, para reproducir el drag&drop de tarjetas sin la app entera.
 *
 * Regresión: las listas de cards deben conectarse vía cdkDropListConnectedTo;
 * un cdkDropListGroup NO llega a ellas porque el cdkDropList exterior de
 * columnas provee CDK_DROP_LIST_GROUP=undefined a sus descendientes.
 */
@Component({
  standalone: true,
  imports: [CdkDropList, CdkDrag, ListColumnComponent],
  template: `
    <div style="height: 400px; display: flex; flex-direction: column;">
      <div
        cdkDropList
        cdkDropListOrientation="horizontal"
        [cdkDropListData]="lists"
        (cdkDropListDropped)="listDrops.push($event)"
        style="flex: 1; min-height: 0; display: flex; gap: 12px; overflow-x: auto; padding: 12px; align-items: flex-start;"
      >
        @for (list of lists; track list.id) {
          <app-list-column
            [list]="list"
            cdkDrag
            [cdkDragData]="list"
            style="display: block; width: 288px; flex-shrink: 0; max-height: 100%;"
          />
        }
      </div>
    </div>
  `,
})
class BoardCanvasHost {
  lists: List[] = [LIST_A, LIST_B];
  listDrops: CdkDragDrop<unknown>[] = [];
}

function mouse(target: EventTarget, type: string, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      // CDK ignora mousedown con buttons/detail en 0 (screen readers)
      buttons: 1,
      detail: 1,
      view: window,
    }),
  );
}

describe('Board drag & drop de tarjetas', () => {
  let store: FakeBoardStore;

  beforeEach(() => {
    store = new FakeBoardStore();
    TestBed.configureTestingModule({
      imports: [BoardCanvasHost],
      providers: [
        { provide: BoardStore, useValue: store },
        { provide: FilterService, useValue: { matches: () => true } },
        { provide: ListsService, useValue: {} },
        { provide: CardsService, useValue: {} },
        { provide: ActivityService, useValue: { log: () => {} } },
        { provide: CurrentUserStore, useValue: { currentId: () => 'm1' } },
        { provide: ToastService, useValue: { error: () => {}, success: () => {} } },
        provideRouter([]),
      ],
    });
  });

  it('mueve una tarjeta de "Por hacer" a la lista vacía "En progreso"', fakeAsync(() => {
    const fixture = TestBed.createComponent(BoardCanvasHost);
    fixture.detectChanges();

    const cardEl = fixture.nativeElement.querySelector('app-card-tile') as HTMLElement;
    const columns = fixture.nativeElement.querySelectorAll('app-list-column');
    expect(cardEl).withContext('la tarjeta debe renderizar en la columna A').toBeTruthy();
    const targetRoot = columns[1].firstElementChild as HTMLElement;

    const from = cardEl.getBoundingClientRect();
    const to = targetRoot.getBoundingClientRect();
    expect(to.width).withContext('la columna destino debe tener área').toBeGreaterThan(0);
    expect(to.height).withContext('la columna destino debe tener área').toBeGreaterThan(0);

    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;

    mouse(cardEl, 'mousedown', startX, startY);
    fixture.detectChanges();
    mouse(document, 'mousemove', startX + 10, startY + 2);
    fixture.detectChanges();
    mouse(document, 'mousemove', endX, endY);
    fixture.detectChanges();
    mouse(document, 'mouseup', endX, endY);
    fixture.detectChanges();
    flush();

    expect(store.moveCard).withContext('onDrop debería invocar moveCard').toHaveBeenCalled();
    const args = store.moveCard.calls.mostRecent().args;
    expect(args[0]).toBe('card-1');
    expect(args[1]).toBe('list-b');
  }));
});
