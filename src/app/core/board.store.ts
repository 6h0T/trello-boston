import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Board, Card, Label, List, Member } from './models/models';
import { BoardsService } from './services/boards.service';
import { ListsService } from './services/lists.service';
import { CardsService } from './services/cards.service';
import { LabelsService } from './services/labels.service';
import { MembersService } from './services/members.service';
import { RealtimeService } from './services/realtime.service';
import { ToastService } from './toast.service';
import { positionAtEnd, positionForIndex } from './util/position';

/**
 * Authoritative, signal-based state for a single open board.
 * Shared by the board view and the card-detail modal so both stay in sync.
 * Provided at the board route level (not root) so it resets per board.
 */
@Injectable()
export class BoardStore {
  private boardsSvc = inject(BoardsService);
  private listsSvc = inject(ListsService);
  private cardsSvc = inject(CardsService);
  private labelsSvc = inject(LabelsService);
  private membersSvc = inject(MembersService);
  private realtime = inject(RealtimeService);
  private toast = inject(ToastService);
  private zone = inject(NgZone);

  private _board = signal<Board | null>(null);
  private _lists = signal<List[]>([]);
  private _cards = signal<Card[]>([]);
  private _labels = signal<Label[]>([]);
  private _allMembers = signal<Member[]>([]);
  private _loading = signal(true);

  readonly board = this._board.asReadonly();
  readonly lists = computed(() => [...this._lists()].sort((a, b) => a.position - b.position));
  readonly cards = this._cards.asReadonly();
  readonly labels = this._labels.asReadonly();
  readonly allMembers = this._allMembers.asReadonly();
  readonly loading = this._loading.asReadonly();

  private channel: RealtimeChannel | null = null;
  private reloadTimer: any = null;
  private currentBoardId: string | null = null;

  /** Cards belonging to a list, ordered. */
  cardsForList(listId: string): Card[] {
    return this._cards()
      .filter((c) => c.list_id === listId && !c.archived)
      .sort((a, b) => a.position - b.position);
  }

  getCard(id: string): Card | undefined {
    return this._cards().find((c) => c.id === id);
  }

  async load(boardId: string): Promise<void> {
    this.currentBoardId = boardId;
    this._loading.set(true);
    try {
      const [board, lists, cards, labels, members] = await Promise.all([
        this.boardsSvc.get(boardId),
        this.listsSvc.listByBoard(boardId),
        this.cardsSvc.listByBoard(boardId),
        this.labelsSvc.listByBoard(boardId),
        this.membersSvc.list(),
      ]);
      this._board.set(board);
      this._lists.set(lists);
      this._cards.set(cards);
      this._labels.set(labels);
      this._allMembers.set(members);
    } catch (e: any) {
      this.toast.error('Error cargando el tablero: ' + (e?.message ?? e));
    } finally {
      this._loading.set(false);
    }

    if (!this.channel) {
      this.channel = this.realtime.subscribeBoard(boardId, () => this.scheduleReload());
    }
  }

  /** Debounced background refresh (used by realtime + after remote-ish writes). */
  scheduleReload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.zone.run(() => this.reloadData());
    }, 250);
  }

  private async reloadData() {
    if (!this.currentBoardId) return;
    try {
      const [lists, cards, labels] = await Promise.all([
        this.listsSvc.listByBoard(this.currentBoardId),
        this.cardsSvc.listByBoard(this.currentBoardId),
        this.labelsSvc.listByBoard(this.currentBoardId),
      ]);
      this._lists.set(lists);
      this._cards.set(cards);
      this._labels.set(labels);
    } catch {
      /* ignore transient */
    }
  }

  async reload(): Promise<void> {
    await this.reloadData();
  }

  /** Refresh only the board record (title, background, members). */
  async reloadBoard(): Promise<void> {
    if (!this.currentBoardId) return;
    try {
      this._board.set(await this.boardsSvc.get(this.currentBoardId));
    } catch {
      /* ignore */
    }
  }

  // ---- local signal patching (so card-detail edits reflect instantly) ----
  patchCard(cardId: string, patch: Partial<Card>) {
    this._cards.update((cards) =>
      cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    );
  }

  upsertCardLocal(card: Card) {
    this._cards.update((cards) => {
      const idx = cards.findIndex((c) => c.id === card.id);
      if (idx === -1) return [...cards, card];
      const copy = [...cards];
      copy[idx] = { ...copy[idx], ...card };
      return copy;
    });
  }

  removeCardLocal(cardId: string) {
    this._cards.update((cards) => cards.filter((c) => c.id !== cardId));
  }

  setLabelsLocal(labels: Label[]) {
    this._labels.set(labels);
  }

  // ---- drag & drop persistence (optimistic) ----
  async moveCard(cardId: string, toListId: string, toIndex: number): Promise<void> {
    const cards = this._cards().map((c) => ({ ...c }));
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const siblings = cards
      .filter((c) => c.list_id === toListId && c.id !== cardId && !c.archived)
      .sort((a, b) => a.position - b.position);
    const position = positionForIndex(siblings, toIndex);
    card.list_id = toListId;
    card.position = position;
    this._cards.set(cards);
    try {
      await this.cardsSvc.move(cardId, toListId, position);
    } catch (e: any) {
      this.toast.error('No se pudo mover la tarjeta');
      this.reload();
    }
  }

  async moveList(listId: string, toIndex: number): Promise<void> {
    const lists = this._lists().map((l) => ({ ...l }));
    const target = lists.find((l) => l.id === listId);
    if (!target) return;
    const others = lists
      .filter((l) => l.id !== listId)
      .sort((a, b) => a.position - b.position);
    const position = positionForIndex(others, toIndex);
    target.position = position;
    this._lists.set(lists);
    try {
      await this.listsSvc.setPosition(listId, position);
    } catch {
      this.toast.error('No se pudo mover la lista');
      this.reload();
    }
  }

  nextCardPosition(listId: string): number {
    return positionAtEnd(this.cardsForList(listId));
  }

  nextListPosition(): number {
    return positionAtEnd(this._lists());
  }

  destroy() {
    if (this.channel) {
      this.realtime.unsubscribe(this.channel);
      this.channel = null;
    }
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }
}
