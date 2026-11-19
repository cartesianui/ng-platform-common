import { effect, ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, ViewChild, computed, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ATTENTION_HOST, AttentionHost, AttentionItem } from './attention-host';

let nextAttentionId = 0;

const SEVERITY_ORDER = ['success', 'info', 'warning', 'danger'] as const;

const SEVERITY_ICON: Record<string, string> = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-circle-exclamation'
};

const rank = (kind: string) => SEVERITY_ORDER.indexOf(kind as (typeof SEVERITY_ORDER)[number]);

/**
 * One actionable alert button, as the chip and the page's Actions menu show it. `run()` clicks the
 * alert's OWN button, so every path calls the same handler, honours the same `disabled`, and exists
 * only while the alert does.
 */
export interface AttentionAction {
  label: string;
  icon: string;
  kind: string;
  disabled: boolean;
  run(): void;
  /** The alert's own button behind this action (internal: lets the chip hide the promoted one in the panel). */
  element?: HTMLButtonElement;
}

/**
 * The attention chip: a compact counter in the action bar standing in for the alerts that used to
 * stack as full-width banners above an edit form.
 *
 * ## What it shows
 *
 * - Nothing on screen: nothing.
 * - Only non-actionable items: a counter, `⚠ 2`. The colour is on the icon only. The tooltip and
 *   accessible name carry each item's one-line summary.
 * - Actionable items: a `btn-group` of `[⚠ N][<most important action>]`, the same height as
 *   Save/Print/Actions. The action button runs that alert's own button. "Most important" means
 *   the highest `priority`, then the highest severity, then the item declared first. Other
 *   actions are in the panel and the Actions menu, so the row never grows past two buttons.
 * - Clicking the counter opens the panel with the complete alerts: message, "Why is this here?",
 *   and the actions. Esc closes it and returns focus to the counter.
 *
 * ## Usage
 *
 * Project it into `default-actions`' `[actionsStart]` slot. Each alert keeps its own `@if`,
 * message and action, and only gains `variant="item"`:
 *
 * ```html
 * <default-actions (save)="onSave()">
 *   <app-attention actionsStart>
 *     <admin-variance-strip variant="item" [documentId]="id" (generate)="onGenerateDocuments($event)"></admin-variance-strip>
 *     <app-alert *ngIf="needsBatch()" variant="item" kind="warning" title="Pick a batch before approving">…</app-alert>
 *   </app-attention>
 *   …
 * </default-actions>
 * ```
 *
 * ## Counting
 *
 * Items REGISTER themselves through `ATTENTION_HOST` instead of being found by a content query,
 * because the most important one, the settlement alert, lives inside `admin-variance-strip`'s own
 * view, where a query on this component cannot reach. Registration follows the alert's lifetime.
 * `default-actions` reads the same registry for its Actions pointer and mirrored menu items
 * (`actions()`), so the chip and the pointer cannot disagree.
 *
 * Blocking alerts (a stuck cancellation, a cancelled record, a refusal that gates Save) do NOT
 * belong here. They stay as banners.
 */
@Component({
  selector: 'app-attention',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  providers: [{ provide: ATTENTION_HOST, useExisting: forwardRef(() => AttentionComponent) }],
  template: `
    <div class="app-attention" [class.app-attention--open]="open()" [hidden]="count() === 0">
      <div class="btn-group" role="group" [attr.aria-label]="popoverLabel">
        <button
          #counter
          type="button"
          class="btn btn-sm app-attention__counter d-inline-flex align-items-center gap-2"
          [attr.data-severity]="severity()"
          aria-haspopup="dialog"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="panelId"
          [attr.aria-label]="counterLabel()"
          [attr.title]="summaries()"
          (click)="toggle()"
        >
          <i [class]="counterIcon() + ' app-attention__icon'" aria-hidden="true"></i>
          <span class="attention-count" [attr.data-severity]="severity()">{{ count() }}</span>
          <i class="fa-solid fa-chevron-down app-attention__caret" aria-hidden="true"></i>
        </button>
        @if (primary(); as action) {
          <button type="button" class="btn btn-sm btn-outline-primary app-attention__action text-nowrap" [disabled]="action.disabled" (click)="action.run()">
            {{ action.label }}
          </button>
        }
      </div>
      <div #panel class="app-attention__panel" [id]="panelId" role="dialog" tabindex="-1" [attr.aria-label]="popoverLabel" [hidden]="!open()">
        <div class="d-flex align-items-center justify-content-between px-3 pt-2 pb-1">
          <span class="small fw-semibold text-uppercase text-body-secondary">{{ popoverLabel }}</span>
          <button type="button" class="btn-close app-attention__close" aria-label="Close" (click)="close(true)"></button>
        </div>
        <ng-content></ng-content>
      </div>
      <div class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcement() }}</div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .app-attention {
        position: relative;
        display: inline-flex;
        align-items: stretch;
      }
      /* Same metrics as default-actions' buttons, whose styles are scoped to that component. */
      .app-attention .btn {
        font-size: 0.8125rem;
        padding: 0.5rem 0.9rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      /* The counter reads as an attention control (owner): a soft tint of the most severe alert's
         colour, the icon in that colour, the count as a pill, and a caret that says it opens.
         Its border matches the action half (outline-primary) so the two read as ONE group. */
      .app-attention__counter {
        --att-rgb: var(--cui-warning-rgb);
        color: var(--cui-body-color);
        background-color: rgba(var(--att-rgb), 0.12);
        border: 1px solid var(--cui-primary);
        cursor: pointer;
        transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
      }
      .app-attention__counter[data-severity='danger'] { --att-rgb: var(--cui-danger-rgb); }
      .app-attention__counter[data-severity='info'] { --att-rgb: var(--cui-info-rgb); }
      .app-attention__counter[data-severity='success'] { --att-rgb: var(--cui-success-rgb); }
      /* Hover: a stronger tint and a heavier edge in the alert's colour. Pressed/open
         (aria-expanded): the strongest tint, so the open state reads as "on". */
      .app-attention__counter:hover {
        background-color: rgba(var(--att-rgb), 0.22);
        border-color: var(--cui-primary);
        box-shadow: inset 0 -2px 0 rgba(var(--att-rgb), 0.55);
      }
      .app-attention__counter:active,
      .app-attention__counter[aria-expanded='true'] {
        background-color: rgba(var(--att-rgb), 0.3);
        border-color: var(--cui-primary);
        box-shadow: inset 0 -2px 0 rgb(var(--att-rgb));
      }
      .app-attention__counter:focus-visible {
        outline: 0;
        box-shadow: 0 0 0 0.2rem rgba(var(--cui-primary-rgb), 0.25);
        z-index: 2;
      }
      .app-attention__icon { color: rgb(var(--att-rgb)); }
      .app-attention__caret {
        font-size: 0.7em;
        opacity: 0.7;
        transition: transform 0.15s ease;
      }
      .app-attention--open .app-attention__caret { transform: rotate(180deg); }
      /* Attention count badge (owner): a circle (pill from 10+), light text on the severity's
         *emphasis* tone. Contrast: white on --cui-warning (#b8730a) is 3.8:1 and fails, so the fill is
         --cui-{severity}-text-emphasis (#764705 in light = 7.9:1 with white). In dark mode that token is
         the light tone, and the text is --cui-body-bg (dark), so it passes both ways. Same in the chip. */
      .attention-count {
        --att-fill: var(--cui-warning-text-emphasis);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.125rem;
        height: 1.125rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        font-size: 0.6875rem;
        font-weight: 700;
        line-height: 1;
        color: var(--cui-body-bg);
        /* Mixed toward the body text colour: darker in light mode (white text 5.6:1 on amber),
           lighter in dark mode (dark --cui-body-bg text). The emphasis tokens alone are the plain
           severity colour in this theme, and white on --cui-warning is only 3.8:1. */
        background-color: color-mix(in srgb, var(--att-fill) 72%, var(--cui-body-color));
      }
      .attention-count[data-severity="danger"] { --att-fill: var(--cui-danger-text-emphasis); }
      .attention-count[data-severity="info"] { --att-fill: var(--cui-info-text-emphasis); }
      .attention-count[data-severity="success"] { --att-fill: var(--cui-success-text-emphasis); }
      .app-attention__panel {
        position: absolute;
        top: calc(100% + 0.375rem);
        /* The chip sits on the right of the action bar: open toward the start so the panel stays inside the drawer. */
        right: 0;
        left: auto;
        z-index: 1060;
        width: min(32rem, calc(100vw - 2rem));
        padding-bottom: 0.25rem;
        background-color: var(--ct-surface);
        border: 1px solid var(--ct-border);
        border-radius: var(--ct-radius);
        box-shadow: var(--ct-card-shadow);
      }
      .app-attention__panel:focus {
        outline: none;
      }
      .app-attention__close {
        font-size: 0.6rem;
      }
    `
  ]
})
export class AttentionComponent implements AttentionHost {
  /** Heading of the panel, also its accessible name. */
  @Input() popoverLabel = 'Needs attention';

  readonly panelId = `app-attention-${++nextAttentionId}`;

  private readonly items = signal<AttentionItem[]>([]);
  private readonly isOpen = signal(false);
  protected readonly announcement = signal('');

  readonly count = computed(() => this.items().length);
  readonly open = this.isOpen.asReadonly();

  /** Highest severity among the items: the only colour on the chip, on its icon. */
  readonly severity = computed(() => {
    let best = -1;
    for (const item of this.items()) {
      best = Math.max(best, rank(item.kind));
    }
    return best < 0 ? 'info' : SEVERITY_ORDER[best];
  });

  /** Every action of every item, most important item first. Read by the chip and by `default-actions`. */
  readonly actions = computed<AttentionAction[]>(() => {
    const ordered = this.items()
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.priority - a.item.priority || rank(b.item.kind) - rank(a.item.kind) || a.index - b.index)
      .map(({ item }) => item);
    const out: AttentionAction[] = [];
    for (const item of ordered) {
      for (const button of item.actionButtons()) {
        out.push({
          label: (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
          icon: item.icon || SEVERITY_ICON[item.kind] || SEVERITY_ICON['info'],
          kind: item.kind,
          get disabled() {
            return button.disabled;
          },
          run: () => button.click(),
          element: button
        });
      }
    }
    return out;
  });

  /** The one action joined to the counter. */
  readonly primary = computed(() => this.actions()[0] ?? null);

  @ViewChild('counter') private counterRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;

  constructor(private readonly el: ElementRef<HTMLElement>) {
    // The action joined to the counter is not repeated inside the panel (owner): hide that one
    // button in its alert while it is promoted. Other actions of the same or other alerts stay.
    // It stays clickable programmatically (run() and the Actions menu click the same element).
    effect(() => {
      const promoted = this.primary()?.element;
      for (const action of this.actions()) {
        action.element?.classList.toggle('d-none', action.element === promoted);
      }
    });
  }

  register(item: AttentionItem): void {
    const before = this.items().length;
    this.items.update((list) => (list.includes(item) ? list : [...list, item]));
    if (this.items().length > before) {
      // After the item has rendered, so its summary is readable.
      queueMicrotask(() => this.announcement.set(this.counterLabel()));
    }
  }

  unregister(item: AttentionItem): void {
    this.items.update((list) => list.filter((i) => i !== item));
    if (this.items().length === 0) {
      this.isOpen.set(false);
    }
  }

  protected counterIcon(): string {
    return SEVERITY_ICON[this.severity()];
  }

  /** Each item's one-line summary, for the tooltip. */
  summaries(): string {
    return this.items()
      .map((item) => item.summaryText())
      .filter((s) => !!s)
      .join('\n');
  }

  counterLabel(): string {
    const n = this.count();
    const lines = this.items()
      .map((item) => item.summaryText())
      .filter((s) => !!s)
      .join('; ');
    return `${n} ${n === 1 ? 'thing needs' : 'things need'} attention${lines ? ': ' + lines : ''}`;
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close(false);
      return;
    }
    this.isOpen.set(true);
    // Focus moves into the panel so it is reachable by keyboard; Esc brings it back.
    setTimeout(() => this.panelRef?.nativeElement.focus());
  }

  close(returnFocus: boolean): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    if (returnFocus) {
      this.counterRef?.nativeElement.focus();
    }
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    this.close(true);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.el.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }
}
