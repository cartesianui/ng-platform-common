import { DestroyRef, Injectable, Injector, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NotifyService } from '@cartesianui/platform-core';

/** localStorage key for the developer-mode flag ('1' on, anything else off). */
export const DEV_MODE_STORAGE_KEY = 'cui.devMode';

/**
 * Developer mode: a per-browser presentation switch that reveals developer aids,
 * such as the "Copy ID" button on `<doc-number>`. It is NOT a permission and gates
 * nothing on the server; it only shows extra copy affordances.
 *
 * Off by default and remembered in localStorage. Storage is optional: blocked or
 * missing storage just means the flag starts off and is not remembered.
 *
 * Toggle: Ctrl+Shift+Alt+U, matched on `event.code === 'KeyU'` so the keyboard layout
 * does not matter. Why this combo:
 *  - Ctrl+Alt+U is AltGr+U on Windows (it types ú on US-International and similar
 *    layouts), and Ctrl+Option is the VoiceOver modifier on macOS (VO+U opens the Rotor).
 *  - Ctrl+Shift+U is Edge's Read Aloud and the GTK/IBus Unicode-entry key on Linux.
 *  - Ctrl+Shift+Alt+U has no Chrome, Edge or Firefox default. On Windows it is
 *    AltGr+Shift+U, which can still type a character (Ú) on some layouts, so the
 *    shortcut is ignored while focus is in a text field and the character is typed.
 *
 * The listener is registered once, when the root injector creates this service.
 * `CommonModule.forRoot()` creates it eagerly, so the shortcut works on every screen.
 */
@Injectable({ providedIn: 'root' })
export class DevModeService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly state = signal<boolean>(this.read());

  /** True while developer mode is on. */
  readonly enabled = this.state.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    if (!view) return;
    const onKeydown = (event: KeyboardEvent) => this.onKeydown(event);
    view.addEventListener('keydown', onKeydown);
    inject(DestroyRef).onDestroy(() => view.removeEventListener('keydown', onKeydown));
  }

  toggle(): void {
    this.set(!this.state());
  }

  set(on: boolean): void {
    this.state.set(on);
    this.write(on);
    try {
      // Resolved on use, not at boot: NotifyService reads the global toaster in its
      // constructor, and an app without it must still boot (this service is eager).
      this.injector.get(NotifyService).info(on ? 'Developer mode on' : 'Developer mode off');
    } catch {
      // No toaster available (tests, harness): the switch still works.
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.code !== 'KeyU' || !event.ctrlKey || !event.altKey || !event.shiftKey || event.metaKey) return;
    if (event.repeat || this.isTextEntry(event.target)) return;
    event.preventDefault();
    this.toggle();
  }

  /** Inputs that accept typed text, textareas, selects and contenteditable regions. */
  private isTextEntry(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== 'string') return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag !== 'input') return false;
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(type);
  }

  private read(): boolean {
    try {
      return this.document.defaultView?.localStorage?.getItem(DEV_MODE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private write(on: boolean): void {
    try {
      this.document.defaultView?.localStorage?.setItem(DEV_MODE_STORAGE_KEY, on ? '1' : '0');
    } catch {
      // Storage blocked: the flag lasts for this page only.
    }
  }
}
