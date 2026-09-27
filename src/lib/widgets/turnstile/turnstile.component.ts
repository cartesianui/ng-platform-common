import {
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Loader state shared by every instance on the page — the Turnstile script is
 * a single global, so a second widget must wait on the first one's load rather
 * than inject a second `<script>`.
 */
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, options: Record<string, unknown>): string;
      remove(id: string): void;
      reset(id?: string): void;
    };
  }
}

/**
 * Cloudflare Turnstile widget.
 *
 * Emits a single-use token that the caller sends to the API as
 * `cf-turnstile-response`. The server decides whether a token is *required* —
 * `user_management.captcha_on_login` / `captcha_on_registration`, verified by
 * `VerifyCaptchaTask` — so this component's only job is to produce one when a
 * site key is configured.
 *
 * ── Why it renders unconditionally ─────────────────────────────────────────
 * The alternative is asking the API whether this tenant wants a captcha before
 * showing one, which needs an authenticated call on a page whose whole purpose
 * is to authenticate. Sending a token the server does not need costs nothing —
 * it is ignored — while *not* sending one the server does need is a locked
 * door. So: render whenever a site key exists, and let the server decide.
 *
 * Given no site key it renders nothing and stays silent, which is what an
 * install without Turnstile configured should see.
 *
 * ── The script is loaded here, not in index.html ───────────────────────────
 * Five applications share this component. Putting the `<script>` in five
 * `index.html` files would load Cloudflare on every page of every app to serve
 * one form. Loading it on first use keeps it on the login screen where it
 * belongs, and `scriptPromise` above makes concurrent widgets share one load.
 */
@Component({
  selector: 'cui-turnstile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (siteKey) {
      <div class="cui-turnstile">
        <div #host></div>
        @if (failed()) {
          <p class="cui-turnstile-error">{{ failureMessage() }}</p>
        }
      </div>
    }
  `,
  styles: [
    `
      .cui-turnstile {
        margin: 0 0 1rem;
      }

      .cui-turnstile-error {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: #dc3545;
      }
    `
  ]
})
export class TurnstileComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Cloudflare site key. Public by design — it identifies the widget and is
   * meant to be in the page. The *secret* key never leaves the server.
   *
   * Read it from `AppConfig` rather than hard-coding it, so each deployment
   * points at its own Turnstile configuration.
   */
  @Input({ required: true }) siteKey!: string;

  /** `light`, `dark`, or `auto` to follow the visitor's system preference. */
  @Input() theme: 'light' | 'dark' | 'auto' = 'auto';

  /** A solved token. Single-use — Cloudflare rejects it a second time. */
  readonly solved = output<string>();

  /**
   * The token is no longer usable: it expired, or the challenge errored. The
   * host form should clear whatever it stored and wait for a fresh `solved`.
   */
  readonly cleared = output<void>();

  /**
   * Why the widget is unusable, or `null` while it is fine.
   *
   * Two causes that look identical to a user and are not:
   *
   *   `unreachable`  — Cloudflare's script did not load. A network or blocking
   *                    problem the visitor might actually be able to act on.
   *   `rejected`     — the script loaded and Cloudflare refused to render. In
   *                    practice this is almost always **the site key not listing
   *                    this hostname** in the Turnstile dashboard, which is a
   *                    configuration problem on our side. Telling a visitor to
   *                    "check your connection" for that sends them chasing a
   *                    fault that is not theirs — as it did on first run here,
   *                    where `localhost` had not been added to the widget's
   *                    allowed domains.
   */
  protected readonly failure = signal<'unreachable' | 'rejected' | null>(null);

  protected readonly failed = computed(() => this.failure() !== null);

  protected readonly failureMessage = computed(() =>
    this.failure() === 'unreachable'
      ? 'The challenge could not be loaded. Check your connection and reload the page.'
      : 'The challenge is unavailable. Please let us know if this keeps happening.'
  );
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  private widgetId: string | null = null;

  ngOnInit(): void {
    // Nothing to do while prerendering, and `window` does not exist there.
    if (!isPlatformBrowser(this.platformId) || !this.siteKey) {
      return;
    }

    void this.load()
      .then(() => this.render())
      .catch(() => this.failure.set('unreachable'));

    this.destroyRef.onDestroy(() => {
      if (this.widgetId !== null) {
        window.turnstile?.remove(this.widgetId);
      }
    });
  }

  /** Ask Cloudflare for a fresh challenge — call after a failed submit. */
  reset(): void {
    if (this.widgetId !== null) {
      window.turnstile?.reset(this.widgetId);
      this.cleared.emit();
    }
  }

  private render(): void {
    const element = this.host()?.nativeElement;

    if (!element || !window.turnstile) {
      this.failure.set('unreachable');
      return;
    }

    this.widgetId = window.turnstile.render(element, {
      sitekey: this.siteKey,
      theme: this.theme,
      callback: (token: string) => this.solved.emit(token),
      // A token is short-lived. Telling the host it has gone stale is better
      // than letting it submit one Cloudflare will reject.
      'expired-callback': () => this.cleared.emit(),
      // Cloudflare passes a code; 110200 is "domain not allowed". Logged rather
      // than shown — it is for whoever configured the widget, not the visitor.
      'error-callback': (code?: string) => {
        console.error('[turnstile] challenge rejected', code ?? '(no code)');
        this.failure.set('rejected');
        this.cleared.emit();
      }
    });
  }

  private load(): Promise<void> {
    if (window.turnstile) {
      return Promise.resolve();
    }

    scriptPromise ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Let a later attempt retry rather than caching the failure forever.
        scriptPromise = null;
        reject(new Error('Turnstile script failed to load'));
      };
      document.head.appendChild(script);
    });

    return scriptPromise;
  }
}
