import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertModule } from 'ngx-bootstrap/alert';

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
  imports: [CommonModule, AlertModule]
})
export class AlertComponent {
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

  @Output() closed = new EventEmitter<void>();

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
