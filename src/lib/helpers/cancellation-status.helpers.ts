import type { BadgeColor } from '../models/types';

/**
 * The cancellation family of statuses — ONE look everywhere.
 *
 * A purchase order, a receive note, an invoice / bill / memo and a payment
 * each carry some of these; each model used to spell its own label and pick
 * its own colour (and the receive-note listing had no badge for `cancelling`
 * at all), so the same state read differently from screen to screen
 * (QA 2026-08-23). Every model's `enumMeta`, listing `valueMap` and filter
 * option spreads from here; add a status here, not in a model.
 *
 *   cancelling  — in flight: the reversals are running, the document is
 *                 locked. Warning + spinner: "wait", not "wrong".
 *   cancelled   — reversed; never validly existed. Danger + ban.
 *   superseded  — concluded by a memo, its voucher standing. Warning, not
 *                 danger: "concluded, look at the memo", not a failure.
 */
export const CancellationFamilyBadges = {
  cancelling: { label: 'Cancelling…', color: 'warning' as BadgeColor, icon: 'fa-solid fa-spinner fa-spin' },
  cancelled:  { label: 'Cancelled',   color: 'danger'  as BadgeColor, icon: 'fa-solid fa-ban' },
  superseded: { label: 'Superseded',  color: 'warning' as BadgeColor, icon: 'fa-solid fa-file-invoice-dollar' },
} as const;

/** `{ label, color }` shape the listing `valueMap` formatter wants. */
export const CancellationFamilyValueMap = {
  cancelling: { label: CancellationFamilyBadges.cancelling.label, color: CancellationFamilyBadges.cancelling.color },
  cancelled:  { label: CancellationFamilyBadges.cancelled.label,  color: CancellationFamilyBadges.cancelled.color },
  superseded: { label: CancellationFamilyBadges.superseded.label, color: CancellationFamilyBadges.superseded.color },
} as const;

/**
 * The OPEN-cancellation marker a listing row carries (`cancellation_state`
 * from the server: 'stuck' | 'running' | null). Icon only, beside the document
 * number, grouped with it in the model's multiline column; null renders
 * nothing. The details — which step, why, Retry — are on the document's edit
 * screen, which the row click opens; the icon just says "look here".
 * (valueMap string entries are rendered as HTML by the cell formatter.)
 */
export const CancellationOpenStateValueMap: Record<string, string> = {
  stuck:   '<i class="fa-solid fa-triangle-exclamation text-danger" title="Cancellation stuck — open to retry"></i>',
  running: '<i class="fa-solid fa-spinner fa-spin text-warning" title="Cancelling…"></i>',
};

/** Cancellation header status (BE `CancellationStatus`). */
export const CancellationStatuses = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED_PARTIAL: 'failed_partial',
} as const;
export type CancellationStatus = (typeof CancellationStatuses)[keyof typeof CancellationStatuses];

/** Cancellation line state (BE `CancellationLineState`). */
export const CancellationLineStates = { PENDING: 'pending', DONE: 'done', FAILED: 'failed' } as const;

/**
 * The answers a cancellation line can carry (BE `CancellationAnswer`).
 *
 * ⚠⚠ **THE GOODS ANSWERS COME IN DIRECTIONAL PAIRS AND THIS SET HELD ONLY THE INWARD ONE.**
 * `NEVER_LEFT` / `COMING_BACK` are the outward mirrors, added to the backend enum under
 * `C3`/`SO-P6.4` and emitted by `BuildSaleOrderCancellationPreviewTask:174-175` for every posted
 * delivery-note row, with `COMING_BACK` as that row's `default_answer` (`:181`). They were absent
 * here — measured 0 files across `ng-web/projects` in all four spellings, against the inward pair
 * at 4-5 as a live control — so nothing in ng-web could match a sales goods row.
 *
 * **Adding them is an insertion on disjoint keys, not a change to purchase.** The eight existing
 * members keep their names and values, and every consumer reaches them by NAME — swept for
 * enumeration (`Object.values/keys/entries` of the constant or of the components' `A` alias,
 * spread, `for…of`, `*ngFor`, and a `switch` over an answer) and found **zero**, with
 * `A.NEVER_ARRIVED` / `A.GOING_BACK` / `CancellationAnswers.` alive as controls and every bare `A`
 * in the templates being English prose inside a comment. **Nothing iterates this object, so no
 * purchase screen can gain a button from these two lines.**
 *
 * ⚠ **The pairs are not interchangeable and the wire keys carry the direction, so a component must
 * RESOLVE which pair a row speaks rather than assume one** — see `DocumentCancelComponent`'s
 * `reverseAnswerFor()` / `returnAnswerFor()`, which read the row's own `availableAnswers`.
 */
export const CancellationAnswers = {
  /** Goods, INWARD: keyed by mistake, they never arrived → reverse the movement. */
  NEVER_ARRIVED: 'never_arrived',

  /** Goods, INWARD: they did arrive and are going back → Purchase Return, stock OUT. */
  GOING_BACK: 'going_back',

  /**
   * Goods, OUTWARD: keyed or shipped by mistake, they never physically left → reverse the
   * movement. The exact mirror of `NEVER_ARRIVED`, one direction over.
   */
  NEVER_LEFT: 'never_left',

  /**
   * Goods, OUTWARD: they did leave and the customer is sending them back → Return Note, stock IN.
   * The mirror of `GOING_BACK`: that one sends goods to a vendor, this one receives them back
   * from a customer.
   */
  COMING_BACK: 'coming_back',

  CANCEL_IT: 'cancel_it',
  DEBIT_MEMO: 'debit_memo',
  NEVER_PAID: 'never_paid',
  ALREADY_REFUNDED: 'already_refunded',
  REFUND: 'refund',
  CREDIT: 'credit',
} as const;

/** The open-cancellation marker a listing row carries (`cancellation_state`). */
export const CancellationOpenStates = { STUCK: 'stuck', RUNNING: 'running' } as const;
