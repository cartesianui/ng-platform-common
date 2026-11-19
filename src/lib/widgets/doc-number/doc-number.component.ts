import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DevModeService } from '../../services/dev-mode.service';

/** How long the "Copied" state stays before the copy icon comes back. */
const COPIED_MS = 1500;

const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '';

/**
 * A document number (SO-000123, INV-000045, JV-000310 …) shown as monospace text
 * with a small copy icon. Clicking the number or the icon copies the value.
 *
 * The whole chip is ONE `<button type="button">`, so it is keyboard focusable and
 * has no nested interactive elements; it is styled to read as text plus an icon,
 * not as a bordered button. On success the icon becomes a check in the success
 * colour, a "Copied" tip shows and a polite live region announces it; it reverts
 * after about 1.5s. No toast.
 *
 * Copy uses `navigator.clipboard.writeText` in a secure context. Dev runs on plain
 * http `*.localhost`, where the Clipboard API is missing or refused, so it falls
 * back to a hidden textarea plus `document.execCommand('copy')`.
 *
 * With developer mode on (`DevModeService`, Ctrl+Shift+Alt+U) and `id` set, a second
 * small icon button (fingerprint, "Copy ID") follows and copies the record id, with the
 * same feedback and fallback. The two buttons are siblings, never nested.
 *
 * Renders nothing when `value` is empty, so the caller keeps its own fallback:
 *
 * @example
 *   @if (salesOrder()?.documentNumber) {
 *     <doc-number [value]="salesOrder()?.documentNumber" [id]="salesOrder()?.id"></doc-number>
 *   } @else {
 *     <strong>Details</strong>
 *   }
 */
@Component({
  selector: 'doc-number',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value()) {
      <button
        type="button"
        class="doc-number btn btn-link p-0 text-reset text-decoration-none"
        [class.is-copied]="copied() === 'number'"
        [attr.aria-label]="'Copy ' + value()"
        (click)="copy('number')"
      >
        <strong class="font-monospace">{{ value() }}</strong>
        <span class="doc-number__icon" aria-hidden="true">
          @if (copied() === 'number') {
            <i class="fa-solid fa-check"></i>
            <span class="doc-number__tip">Copied</span>
          } @else {
            <i class="fa-regular fa-copy"></i>
          }
        </span>
      </button>
      @if (showId()) {
        <button
          type="button"
          class="doc-number doc-number--id btn btn-link p-0 text-reset text-decoration-none"
          [class.is-copied]="copied() === 'id'"
          aria-label="Copy document ID"
          title="Copy ID"
          (click)="copy('id')"
        >
          <span class="doc-number__icon" aria-hidden="true">
            @if (copied() === 'id') {
              <i class="fa-solid fa-check"></i>
              <span class="doc-number__tip">Copied</span>
            } @else {
              <i class="fa-solid fa-fingerprint"></i>
            }
          </span>
        </button>
      }
      <span class="visually-hidden" aria-live="polite">{{ announcement() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .doc-number {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: inherit;
      line-height: inherit;
      vertical-align: baseline;
      border: 0;
      border-radius: 0.25rem;
    }
    .doc-number:focus-visible {
      outline: 0;
      box-shadow: 0 0 0 0.2rem rgba(var(--cui-primary-rgb), 0.25);
    }

    .doc-number__icon {
      position: relative;
      display: inline-flex;
      font-size: 0.8125em;
      color: var(--cui-secondary-color);
      opacity: 0.6;
      transition: opacity 0.15s ease, color 0.15s ease;
    }
    .doc-number:hover .doc-number__icon,
    .doc-number:focus-visible .doc-number__icon {
      color: var(--cui-primary);
      opacity: 1;
    }
    .doc-number.is-copied .doc-number__icon {
      color: var(--cui-success);
      opacity: 1;
    }

    /* The tip sits to the RIGHT of the icon, not above it: edit headers live in
       .bounded-form columns that clip overflow, which cut off a tip placed above. */
    .doc-number__tip {
      position: absolute;
      top: 50%;
      left: calc(100% + 0.375rem);
      transform: translateY(-50%);
      padding: 0.125rem 0.5rem;
      font-family: var(--cui-body-font-family);
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.4;
      white-space: nowrap;
      color: var(--cui-body-bg);
      background: var(--cui-emphasis-color);
      border-radius: 0.25rem;
      pointer-events: none;
      z-index: 5;
    }
  `
})
export class DocNumberComponent {
  private readonly document = inject(DOCUMENT);
  private readonly devMode = inject(DevModeService);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The document number to show and copy. Empty, null or undefined renders nothing. */
  readonly value = input<string | number | null | undefined>(undefined);

  /** The record's id. With developer mode on, a "Copy ID" button copies it. */
  readonly id = input<string | number | null | undefined>(undefined);

  /** Which value was just copied, for the ~1.5s feedback. */
  protected readonly copied = signal<'number' | 'id' | null>(null);

  protected readonly showId = computed(() => this.devMode.enabled() && !isEmpty(this.id()));

  protected readonly announcement = computed(() => {
    switch (this.copied()) {
      case 'number': return 'Copied ' + this.value();
      case 'id': return 'Copied document ID ' + this.id();
      default: return '';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Fallback toggle (owner): 5 clicks on the number within 2s switch developer mode. */
  private clicks: number[] = [];
  private countToggleClick(): void {
    const now = Date.now();
    this.clicks = [...this.clicks.filter((t) => now - t < 2000), now];
    if (this.clicks.length >= 5) {
      this.clicks = [];
      this.devMode.toggle();
    }
  }

  protected async copy(which: 'number' | 'id'): Promise<void> {
    if (which === 'number') this.countToggleClick();
    const v = which === 'number' ? this.value() : this.id();
    if (isEmpty(v)) return;
    if (!(await this.write(String(v)))) return;
    this.copied.set(which);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(null), COPIED_MS);
  }

  private async write(text: string): Promise<boolean> {
    const view = this.document.defaultView;
    const clipboard = view?.navigator?.clipboard;
    if (clipboard && view?.isSecureContext) {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // Refused (permissions, focus): try the legacy path below.
      }
    }
    return this.legacyCopy(text);
  }

  /** Non-secure contexts (http dev hosts): copy through a hidden, off-screen textarea. */
  private legacyCopy(text: string): boolean {
    const doc = this.document;
    const previous = doc.activeElement as HTMLElement | null;
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '-9999px';
    area.style.opacity = '0';
    doc.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = doc.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    previous?.focus?.();
    return ok;
  }
}
