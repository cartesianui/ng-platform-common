import { InjectionToken } from '@angular/core';

/**
 * One `<default-actions>` row offered to a container's header (see `ACTIONS_HEADER_HOST`).
 */
export interface ActionsHeaderClaim {
  /** The row itself: `default-actions`' root `.app-actions` element. */
  readonly element: HTMLElement;
  /**
   * Where the row lives when it is not in the header (the `<default-actions>` host). Also orders
   * competing claims: the one earliest in the document wins the header.
   */
  readonly home: HTMLElement;
  /** Told `true` when the row has moved into the header, `false` when it has gone back home. */
  placed(inHeader: boolean): void;
}

/**
 * A container with a title bar that can carry the page's action row (`app-offcanvas`).
 *
 * `default-actions` injects it optionally: none provided (a routed page, a card) and nothing
 * changes. Provided, the row is MOVED into the host's header slot. It is a DOM move of a node
 * Angular created, so its bindings, handlers, projected content and `@if` blocks keep working.
 * The nearest provider wins, so a drawer opened from inside a drawer carries its own row.
 */
export interface ActionsHeaderHost {
  claim(claim: ActionsHeaderClaim): void;
  release(claim: ActionsHeaderClaim): void;
}

export const ACTIONS_HEADER_HOST = new InjectionToken<ActionsHeaderHost>('ACTIONS_HEADER_HOST');

/**
 * The standard host: one header slot, at most one row in it.
 *
 * When several rows claim the same slot at once, the one earliest in the document wins and the
 * others stay where they are; when the winner goes, the next one moves up. Rows that claim before
 * the slot exists wait for `connect()`.
 */
export class ActionsHeaderSlot implements ActionsHeaderHost {
  private slot?: HTMLElement;
  private claims: ActionsHeaderClaim[] = [];
  private current?: ActionsHeaderClaim;

  connect(slot: HTMLElement): void {
    this.slot = slot;
    this.update();
  }

  disconnect(): void {
    this.slot = undefined;
    this.update();
  }

  claim(claim: ActionsHeaderClaim): void {
    if (!this.claims.includes(claim)) {
      this.claims.push(claim);
    }
    this.update();
  }

  release(claim: ActionsHeaderClaim): void {
    this.claims = this.claims.filter((c) => c !== claim);
    this.update();
  }

  private update(): void {
    const winner = this.slot ? this.first() : undefined;
    if (winner === this.current) {
      return;
    }
    if (this.current) {
      // Back inside its own host, so Angular removes it with that host as usual.
      this.current.home.appendChild(this.current.element);
      this.current.placed(false);
    }
    this.current = winner;
    if (winner && this.slot) {
      this.slot.appendChild(winner.element);
      winner.placed(true);
    }
  }

  private first(): ActionsHeaderClaim | undefined {
    return this.claims.reduce<ActionsHeaderClaim | undefined>((best, c) => {
      if (!best) {
        return c;
      }
      // eslint-disable-next-line no-bitwise
      return best.home.compareDocumentPosition(c.home) & Node.DOCUMENT_POSITION_PRECEDING ? c : best;
    }, undefined);
  }
}
