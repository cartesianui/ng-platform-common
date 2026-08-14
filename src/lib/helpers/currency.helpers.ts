import { regionalCurrency, regionalLocale } from './regional.helpers';

/**
 * Currency / decimal helpers — pure-function utilities for rounding
 * decimal numbers and formatting them as currency strings.
 *
 * Locale + currency code default to the runtime `cartesian.regional`
 * block (resolved tenant + user prefs) via the `regionalLocale` /
 * `regionalCurrency` getters in `regional.helpers.ts`.
 *
 * Companion runtime surfaces:
 *   - `RegionalCurrencyPipe`   — template-side display (`| regionalCurrency`)
 *   - `DecimalFormatDirective` — editable-input twin (`<input decimalFormat>`)
 *   - `FormatterRegistry.register('currency', ...)` — EntityMeta column/form formatter
 *
 * All three pre-round via `roundDecimal` and default to 2dp because CLDR's
 * per-currency default for PKR is 0 fraction digits, which truncates line
 * totals (24.95 → "Rs 25") — invisible until you debug a missing penny.
 */

/**
 * Round a decimal value to a fixed precision. Crushes IEEE-754 binary-float
 * drift before writing the result into a form control or sending it to the
 * BE.
 *
 * Why: `4.99 * 5 === 24.950000000000003` in JS. Naively `patchValue`ing
 * that into the form makes both the displayed total and the saved
 * payload carry the drift.
 *
 * Defaults to 2dp (matches the BE money column precision — `decimal(15,2)`
 * on inventory/doc total columns). Pass `precision` for higher-precision
 * cases (unit prices with 4dp, tax rates, etc.).
 */
export function roundDecimal(value: number | string | null | undefined, precision = 2): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return 0;
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

/**
 * Parse Angular's `digitsInfo` string (e.g. `'1.2-2'`) into the matching
 * `Intl.NumberFormatOptions` keys. Returns an empty object when the input
 * is missing or unparseable — callers can spread the result straight into
 * an options bag without conditional logic.
 *
 * `digitsInfo` shape: `minIntegerDigits.minFractionDigits-maxFractionDigits`.
 */
export interface LineTaxResult {
  /** Net (pre-tax) line amount. */
  net: number;
  /** Tax amount for the line. */
  tax: number;
}

/**
 * Optional fixed-amount tax inputs for {@link resolveLineTax}, mirroring the
 * BE `ResolveLineTaxTask` `type=fixed` branch. Omit entirely for the
 * percentage-rate path — the signature and rate math stay byte-for-byte
 * identical for existing callers that pass only the positional args.
 *
 *   - `type === 'fixed'` → tax = fixedAmount * qty (per-unit fixed amount),
 *     `tax_rate` reported as 0; inclusive subtracts the fixed amount from the
 *     net, exclusive keeps the net at base. The positional `taxRate` arg is
 *     ignored in this branch (matches the BE, which returns tax_rate 0 for
 *     fixed categories).
 *   - `type === 'rate'` (or undefined) → the existing percentage-rate path.
 */
export interface LineTaxOptions {
  /** Tax category type. Defaults to `'rate'` (existing behavior). */
  type?: 'rate' | 'fixed' | string | null | undefined;
  /** Per-unit fixed amount (used only when `type === 'fixed'`). */
  fixedAmount?: number | string | null | undefined;
}

/**
 * Resolve a charge line's NET (pre-tax) amount and its tax, mirroring the BE
 * `ResolveLineTaxTask` math so FE displays match the persisted snapshot.
 *
 *   base = unitPrice * qty - discount
 *
 * Rate path (default — `opts` omitted or `opts.type !== 'fixed'`):
 *   - exclusive: net = base,                tax = base * rate%
 *   - inclusive: net = base / (1 + rate%),  tax = base - net
 *   - rate 0: tax = 0
 *
 * Fixed path (`opts.type === 'fixed'`, `opts.fixedAmount` = F per unit):
 *   - fixed = F * qty
 *   - exclusive: net = base,         tax = fixed
 *   - inclusive: net = base - fixed, tax = fixed
 *   - tax_rate is 0 (the positional `taxRate` arg is ignored here).
 *
 * Keep `net` as the line total everywhere (BE stores `line_total` = net), and
 * sum `tax` separately into the document tax total.
 */
export function resolveLineTax(
  taxRate: number | string | null | undefined,
  unitPrice: number | string | null | undefined,
  qty: number | string | null | undefined,
  discount: number | string | null | undefined = 0,
  inclusive = false,
  opts?: LineTaxOptions,
): LineTaxResult {
  // NOT pre-rounded here — the BE (`ResolveLineTaxTask`) keeps `base`
  // (and the fixed-amount `fixed`) unrounded all the way through the
  // calculation and only rounds the final line_total/tax_amount once, at
  // the very end. Rounding `base` first, as this used to, drifted the FE
  // preview a few currency units off the BE-persisted snapshot on
  // fractional qty/unitPrice/discount combinations — reported as "tax is
  // off by ~5-10".
  const base = (Number(unitPrice) || 0) * (Number(qty) || 0) - (Number(discount) || 0);

  if (opts?.type === 'fixed') {
    const fixed = (Number(opts.fixedAmount) || 0) * (Number(qty) || 0);
    if (inclusive) {
      return { net: roundDecimal(base - fixed), tax: roundDecimal(fixed) };
    }
    return { net: roundDecimal(base), tax: roundDecimal(fixed) };
  }

  const rate = Number(taxRate) || 0;
  if (rate === 0) return { net: roundDecimal(base), tax: 0 };
  if (inclusive) {
    const net = roundDecimal(base / (1 + rate / 100));
    return { net, tax: roundDecimal(base - net) };
  }
  return { net: roundDecimal(base), tax: roundDecimal(base * rate / 100) };
}

export function parseDigitsInfo(digitsInfo?: string): Pick<
  Intl.NumberFormatOptions,
  'minimumIntegerDigits' | 'minimumFractionDigits' | 'maximumFractionDigits'
> {
  if (!digitsInfo) return {};
  const m = /^(\d+)\.(\d+)-(\d+)$/.exec(digitsInfo);
  if (!m) return {};
  return {
    minimumIntegerDigits: parseInt(m[1], 10),
    minimumFractionDigits: parseInt(m[2], 10),
    maximumFractionDigits: parseInt(m[3], 10),
  };
}

/**
 * Format a decimal as currency for display. Uses `cartesian.regional`'s
 * locale + currency when not overridden. Pass an explicit `currency` for
 * one-off non-default displays (reports / FX). For Angular templates,
 * prefer the `regionalCurrency` pipe.
 */
export function formatPrice(
  amount: number | string | null | undefined,
  opts?: { locale?: string; currency?: string },
): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '';

  return new Intl.NumberFormat(opts?.locale ?? regionalLocale(), {
    style: 'currency',
    currency: opts?.currency ?? regionalCurrency(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
