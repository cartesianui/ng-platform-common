import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertModule } from 'ngx-bootstrap/alert';
import { ATTENTION_HOST, AttentionItem } from '../attention/attention-host';

export type AppAlertKind = 'info' | 'success' | 'warning' | 'danger';

/**
 * How the supporting detail is presented — same `display` idiom as `default-actions`.
 *
 * - `collapsed` (default) — behind a toggle. The headline stays the loud thing; the reason is
 *   one click away. Right for detail that matters occasionally, which is most of it.
 * - `expanded` — always open, no toggle. For the alert whose detail IS the message, where
 *   hiding it would just cost everyone a click.
 * - `inline` — appended to the headline as a sentence, no toggle. For a single short line that
 *   is not worth a control of its own.
 * - `none` — detail suppressed entirely. Lets a caller pass lines and decide later whether to
 *   show them, without branching the template.
 */
export type AlertDetailDisplay = 'collapsed' | 'expanded' | 'inline' | 'none';

/**
 * Presentation only — the message, condition and actions are the caller's either way.
 *
 * - `banner` (default) — the full alert box, exactly as it has always rendered.
 * - `item` — a compact row for the attention popover. Inside an `<app-attention>` it registers
 *   itself, so the chip counts it and its `[alertActions]` buttons are mirrored into the page's
 *   Actions menu. Outside one it renders as a plain row.
 * - `note` — a muted one-liner in `value-info`'s grammar, the tone on the icon only. For standing
 *   cautions that explain a status and ask for nothing.
 */
export type AlertVariant = 'banner' | 'item' | 'note';

const DEFAULT_ICON: Record<AppAlertKind, string> = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-circle-exclamation'
};

/**
 * The app's one alert. Headline always visible; supporting detail behind a toggle.
 *
 * ## Why the detail collapses
 *
 * An alert's headline names the CONSEQUENCE — "1 document to raise" — which is what the
 * operator acts on. But the same headline routinely covers situations that call for opposite
 * actions: a debit memo is either a settled return or goods billed and not yet posted; an
 * over-delivery is either a genuine over-shipment or an order somebody reduced below what had
 * already arrived. Without the reason, the reviewer read "a debit memo" as "someone returned
 * something" and would have raised a document that the pending receipt was about to make wrong.
 *
 * Printing every reason inline was the first attempt and it buries the headline — the thing
 * that is true every time is drowned by the thing that matters occasionally. So detail is
 * present, one click away, and collapsed by default: nothing is hidden, nothing shouts.
 *
 * ## Standalone
 *
 * Was `standalone: false`, which meant no standalone component could use it — and the app is
 * mostly standalone now, so the screens with the most to explain were exactly the ones locked
 * out. `CommonModule` still exports it, so all 25 existing template usages are untouched.
 */
@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AlertModule],
  styles: [
    `
      .app-alert-item {
        padding: 0.5rem 1rem;
        border-top: 1px solid var(--ct-border-soft);
      }
      .app-alert-item__body {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .app-alert-item__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
        padding-inline-start: 1.75rem;
      }
      .app-alert-item__actions:empty {
        display: none;
      }
      /* The row is already small; a caller's own .small inside it must not shrink twice. */
      :host ::ng-deep .app-alert-item__message .small {
        font-size: inherit;
      }
    `
  ]
})
export class AlertComponent implements OnInit, AfterViewChecked, OnDestroy, AttentionItem {
  @Input() kind: AppAlertKind = 'info';
  @Input() title?: string;
  @Input() dismissible: boolean = false;
  @Input() icon?: string;

  /**
   * The supporting lines. Empty (the default) renders no toggle at all — an alert with nothing
   * to expand must not offer to expand, or the control teaches people it is worth ignoring.
   */
  @Input() details: string[] = [];

  /** Label for the toggle. Overridable because "Why?" does not suit every alert. */
  @Input() detailsLabel = 'Why?';

  /** How the detail is shown. See {@link AlertDetailDisplay}. */
  @Input() display: AlertDetailDisplay = 'collapsed';

  /** See {@link AlertVariant}. `banner` keeps today's output. */
  @Input() variant: AlertVariant = 'banner';

  /**
   * The one-line summary the chip shows in its tooltip and accessible name, e.g.
   * `1 thing to settle · Rs 1,755.00`. Falls back to the title, then the message text.
   */
  @Input() summary?: string;

  /**
   * Which actionable item's first button joins the chip when several are present. Higher wins;
   * ties go to the higher severity, then to the item declared first.
   */
  @Input() priority = 0;

  @Output() closed = new EventEmitter<void>();

  private readonly host = inject(ATTENTION_HOST, { optional: true });

  @ViewChild('message') private messageRef?: ElementRef<HTMLElement>;
  @ViewChild('actionsBox') private actionsRef?: ElementRef<HTMLElement>;

  private registered = false;

  /*
   * What the host reads, as signals. The message and the buttons are projected and only reach
   * the DOM when this view renders, which is after the host's own view; a signal set here makes
   * Angular re-check the host in the same pass instead of showing a stale label.
   */
  private readonly summarySig = signal('');
  private readonly buttonsSig = signal<HTMLButtonElement[]>([]);

  ngOnInit(): void {
    if (this.variant === 'item' && this.host) {
      this.host.register(this);
      this.registered = true;
    }
  }

  ngAfterViewChecked(): void {
    if (!this.registered) {
      return;
    }
    const text = (this.summary || this.title || this.messageRef?.nativeElement.textContent || '').replace(/\s+/g, ' ').trim();
    if (text !== this.summarySig()) {
      this.summarySig.set(text);
    }
    const box = this.actionsRef?.nativeElement;
    const buttons = box ? Array.from(box.querySelectorAll('button')) : [];
    const current = this.buttonsSig();
    if (buttons.length !== current.length || buttons.some((b, i) => b !== current[i])) {
      this.buttonsSig.set(buttons);
    }
  }

  ngOnDestroy(): void {
    if (this.registered) {
      this.host?.unregister(this);
    }
  }

  protected get defaultIcon(): string {
    return DEFAULT_ICON[this.kind] ?? DEFAULT_ICON.info;
  }

  summaryText(): string {
    return this.summarySig();
  }

  actionButtons(): HTMLButtonElement[] {
    return this.buttonsSig();
  }

  private readonly userExpanded = signal(false);

  protected get hasDetails(): boolean {
    return this.display !== 'none' && (this.details?.length ?? 0) > 0;
  }

  /** Only `collapsed` earns a toggle: the others have nothing for it to do. */
  protected get showsToggle(): boolean {
    return this.hasDetails && this.display === 'collapsed';
  }

  protected get showsDetailBlock(): boolean {
    return this.hasDetails && (this.display === 'expanded' || (this.display === 'collapsed' && this.userExpanded()));
  }

  /** One sentence beside the headline, for `inline`. */
  protected get inlineDetail(): string | null {
    return this.hasDetails && this.display === 'inline' ? this.details.join(' ') : null;
  }

  protected expanded(): boolean {
    return this.userExpanded();
  }

  protected toggle(): void {
    this.userExpanded.update((v) => !v);
  }

  protected onClosed(): void {
    this.closed.emit();
  }
}
