import { InjectionToken, Signal } from '@angular/core';

/**
 * What an `<app-alert variant="item">` needs from the `<app-attention>` it sits in.
 *
 * A token, not the component class, so `AlertComponent` and `AttentionComponent` do not import
 * each other. Resolved through the element-injector chain, so an item still finds its host when it
 * is nested inside another component's view — `admin-variance-strip` renders its `app-alert` in
 * its own template, and a `ContentChildren` query on the host would never see it.
 */
export interface AttentionHost {
  /** True while the panel is open. */
  readonly open: Signal<boolean>;
  register(item: AttentionItem): void;
  unregister(item: AttentionItem): void;
}

/** The part of an alert item the host reads. Implemented by `AlertComponent`. */
export interface AttentionItem {
  readonly kind: 'info' | 'success' | 'warning' | 'danger';
  readonly icon?: string;
  /** Higher wins the chip's action slot. */
  readonly priority: number;
  /** One-line summary for the chip's tooltip and accessible name. */
  summaryText(): string;
  /** The item's projected `[alertActions]` buttons, in order. Empty when it has none. */
  actionButtons(): HTMLButtonElement[];
}

export const ATTENTION_HOST = new InjectionToken<AttentionHost>('ATTENTION_HOST');
