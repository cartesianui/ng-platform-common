import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  ViewChild,
  inject,
  input,
  signal
} from '@angular/core';

let nextId = 0;

/**
 * DOC TOTALS PANEL — the collapsible totals readout of a document form's footer (`.doc-totals`).
 *
 * Collapsed (the default) it is one slim button showing the projected `[docTotalsSummary]` content
 * (Grand Total, Balance …). Expanded, a floating card opens UPWARD over the line items, anchored to
 * the panel's bottom-right, and shows the projected `[docTotalsDetail]` content (the full breakdown).
 * The card is absolutely positioned, so opening it changes neither the footer's height nor the
 * line-items scroll area of the bounded form.
 *
 * The detail stays rendered while collapsed (hidden with `visibility`), so anything inside it keeps
 * running exactly as it did in the old always-open strip. Hidden form inputs should still sit OUTSIDE
 * this component, in the footer row, so the formGroup never depends on the panel.
 *
 * Open / closed is remembered in localStorage under `storageKey` (one preference shared by every form
 * that keeps the default key). Storage is optional: a blocked or missing localStorage just means the
 * panel starts collapsed.
 *
 * Once opened it STAYS open (owner, 2026-11-18): it never collapses on its own, not on a click elsewhere.
 * The user collapses it by hand: the toggle, the collapse chevron, or Esc. Each of those saves the
 * preference. Focus moves into the card on open and back to the toggle on close.
 *
 * Usage:
 * ```html
 * <doc-totals-panel label="Order totals">
 *   <span docTotalsSummary>… Grand Total …</span>
 *   <div docTotalsDetail>… Sub Total, Tax, Grand Total, WHT, Payment …</div>
 * </doc-totals-panel>
 * ```
 */
@Component({
  selector: 'doc-totals-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'doc-totals-panel',
    '[class.is-open]': 'open()',
    '(document:keydown.escape)': 'onEscape($event)',
    '(window:resize)': 'fitCard()'
  },
  template: `
    <button
      #toggleButton
      type="button"
      class="doc-totals-panel__toggle"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="cardId"
      (click)="toggle()"
    >
      <span class="doc-totals-panel__summary"><ng-content select="[docTotalsSummary]"></ng-content></span>
      <span class="visually-hidden">{{ open() ? 'Hide' : 'Show' }} {{ label() }} breakdown</span>
      <i class="fa-solid fa-chevron-up doc-totals-panel__chevron" aria-hidden="true"></i>
    </button>

    <div
      #card
      class="doc-totals-panel__card bg-body border rounded-3 shadow"
      role="region"
      tabindex="-1"
      [id]="cardId"
      [attr.aria-label]="label() + ' breakdown'"
      [style.max-height.px]="maxHeight()"
    >
      <div class="doc-totals-panel__card-head">
        <span class="doc-totals-panel__card-title">{{ label() }}</span>
        <button type="button" class="btn btn-sm btn-link doc-totals-panel__collapse" (click)="close(true, true)">
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          <span class="visually-hidden">Hide {{ label() }} breakdown</span>
        </button>
      </div>
      <div class="doc-totals-panel__card-body">
        <ng-content select="[docTotalsDetail]"></ng-content>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      margin-left: auto;
    }

    .doc-totals-panel__toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 12.5rem;
      padding: 0.375rem 0.75rem 0.375rem 1rem;
      color: var(--cui-body-color);
      text-align: left;
      background: rgba(var(--cui-primary-rgb), 0.05);
      border: 1px solid rgba(var(--cui-primary-rgb), 0.18);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    .doc-totals-panel__toggle:hover {
      background: rgba(var(--cui-primary-rgb), 0.09);
      border-color: rgba(var(--cui-primary-rgb), 0.3);
    }
    .doc-totals-panel__toggle:focus-visible {
      outline: 0;
      box-shadow: 0 0 0 0.2rem rgba(var(--cui-primary-rgb), 0.25);
    }

    .doc-totals-panel__summary {
      display: flex;
      flex: 1 1 auto;
      justify-content: flex-end;
      /* Amounts never break mid-number (Rs 1,403,985.96 on one line): the readout grows to fit instead. */
      white-space: nowrap;
    }

    .doc-totals-panel__chevron {
      flex: 0 0 auto;
      font-size: 0.75rem;
      color: var(--cui-secondary-color);
      transition: transform 0.15s ease;
    }
    :host(.is-open) .doc-totals-panel__chevron {
      transform: rotate(180deg);
    }

    .doc-totals-panel__card {
      position: absolute;
      right: 0;
      bottom: calc(100% + 0.5rem);
      z-index: 5;
      /* As wide as its longest figure needs (so large amounts stay on one line), never narrower than the
         readout or 18rem, never wider than the screen. */
      width: max-content;
      min-width: max(100%, 18rem);
      max-width: calc(100vw - 2rem);
      overflow-y: auto;
      /* Never a sideways scrollbar: the card sizes to its content (max-content) within the room it has. */
      overflow-x: hidden;
      overscroll-behavior: contain;
      visibility: hidden;
      opacity: 0;
      transform: translateY(0.5rem);
      pointer-events: none;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0s linear 0.15s;
    }
    :host(.is-open) .doc-totals-panel__card {
      visibility: visible;
      opacity: 1;
      transform: none;
      pointer-events: auto;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0s;
    }
    .doc-totals-panel__card:focus {
      outline: 0;
    }

    .doc-totals-panel__card-head {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0.5rem 0.25rem 1rem;
      background: inherit;
      border-bottom: 1px solid var(--cui-border-color);
    }
    .doc-totals-panel__card-title {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--cui-secondary-color);
    }
    .doc-totals-panel__collapse {
      color: var(--cui-secondary-color);
    }

    .doc-totals-panel__card-body {
      display: flex;
      flex-direction: column;
      padding: 0.625rem 1rem 0.75rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .doc-totals-panel__toggle,
      .doc-totals-panel__chevron,
      .doc-totals-panel__card,
      :host(.is-open) .doc-totals-panel__card {
        transition: none;
      }
    }
  `
})
export class DocTotalsPanelComponent implements OnInit {
  /** Heading of the card, and the accessible name of the breakdown ("<label> breakdown"). */
  readonly label = input<string>('Totals');

  /** localStorage key for the open / closed preference. Keep the default to share one preference across forms. */
  readonly storageKey = input<string>('shopifier.docTotalsPanel.open');

  protected readonly cardId = `doc-totals-panel-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly maxHeight = signal<number | null>(null);

  @ViewChild('toggleButton', { static: true }) private toggleButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('card', { static: true }) private card!: ElementRef<HTMLElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Re-fit when the bounded card body changes size (lines loading, viewport resize).
    afterNextRender(() => {
      this.fitCard();
      const bound = this.boundedAncestor();
      if (!bound || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.fitCard());
      observer.observe(bound);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    if (this.readStored()) {
      this.open.set(true);
    }
  }

  toggle(): void {
    if (this.open()) {
      this.close(true, true);
    } else {
      this.show();
    }
  }

  show(): void {
    this.fitCard(true);
    this.open.set(true);
    this.store(true);
    // The card turns visible on the next render; focus it then.
    setTimeout(() => this.card.nativeElement.focus({ preventScroll: true }));
  }

  /**
   * @param restoreFocus return focus to the toggle.
   * @param remember     save "closed" as the preference (every close is the user's own: toggle, chevron, Esc).
   */
  close(restoreFocus: boolean, remember = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (remember) this.store(false);
    if (restoreFocus) {
      this.toggleButton.nativeElement.focus({ preventScroll: true });
    }
  }


  protected onEscape(event: Event): void {
    if (!this.open()) return;
    const focusInside = this.host.nativeElement.contains(document.activeElement);
    // Esc is a deliberate collapse by hand, so it saves the preference like the chevron.
    this.close(focusInside, true);
    // Esc that closed the panel should not also close a dialog the form sits in.
    event.stopPropagation();
  }

  /**
   * Cap the card's height to the room above the panel inside the form's bounded card body
   * (`.doc-form-card-body`, overflow: hidden), so a tall breakdown scrolls inside the card instead of
   * being clipped at the top. No bounded ancestor: no cap.
   */
  protected fitCard(force = false): void {
    if (!force && !this.open()) return;
    const hostEl = this.host.nativeElement;
    const bound = this.boundedAncestor();
    if (!bound) {
      this.maxHeight.set(null);
      return;
    }
    const gap = 8;
    const room = hostEl.getBoundingClientRect().top - bound.getBoundingClientRect().top - gap * 2;
    this.maxHeight.set(Math.max(Math.floor(room), 96));
  }

  private boundedAncestor(): HTMLElement | null {
    return this.host.nativeElement.closest('.doc-form-card-body') as HTMLElement | null;
  }

  private readStored(): boolean {
    try {
      return globalThis.localStorage?.getItem(this.storageKey()) === '1';
    } catch {
      return false;
    }
  }

  private store(open: boolean): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey(), open ? '1' : '0');
    } catch {
      // Storage blocked or full: the panel still works, it just won't remember.
    }
  }
}
