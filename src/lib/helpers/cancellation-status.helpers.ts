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
