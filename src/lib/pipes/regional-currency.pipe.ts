import { Pipe, PipeTransform } from '@angular/core';
import { parseDigitsInfo, roundDecimal } from '../helpers/currency.helpers';

/**
 * Currency pipe that defaults its currency code + locale from the runtime
 * `cartesian.regional` block (resolved tenant + user formatting prefs).
 * Drop-in replacement for templates that previously hardcoded
 * `currency:'PKR':'symbol-narrow':'1.2-2':'en-PK'`.
 *
 * USAGE:
 *   {{ amount | regionalCurrency }}
 *   {{ amount | regionalCurrency:'symbol-narrow' }}
 *   {{ amount | regionalCurrency:'symbol-narrow':'1.2-2' }}
 *
 * Args mirror Angular's built-in `currency` pipe for the parts we care
 * about — display style and digits. Currency code + locale are NOT
 * configurable per-call by design: per the localization workstream,
 * `cartesian.regional` is the single source of truth (D8). For one-off
 * non-default displays use `formatPrice(amount, { currency, locale })`
 * from `regional.helpers.ts`.
 *
 * Falls back to `'PKR'` / `'en-PK'` when `cartesian.regional` hasn't loaded
 * yet (early app boot, unauth contexts) — same fallbacks `RegionalService`
 * uses.
 */
@Pipe({
  name: 'regionalCurrency',
  standalone: true,
})
export class RegionalCurrencyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    display: 'symbol' | 'symbol-narrow' | 'code' | 'name' = 'symbol',
    digitsInfo?: string,
  ): string {
    if (value === null || value === undefined || value === '') return '';
    const raw = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(raw)) return '';

    // Parse the caller's digit overrides once; defaults to 2dp when absent
    // (CLDR's PKR default of 0 fraction digits would otherwise truncate
    // `24.95` → `Rs 25`). Pre-round so a drifted input like
    // `24.950000000000003` is clean before `Intl.NumberFormat` sees it.
    const digits = parseDigitsInfo(digitsInfo);
    const precision = digits.maximumFractionDigits ?? 2;
    const n = roundDecimal(raw, precision);

    const locale = (cartesian as any).regional?.locale ?? 'en-PK';
    const currency = (cartesian as any).regional?.currency ?? 'PKR';

    // Map Angular's `display` arg → Intl currencyDisplay equivalent.
    const currencyDisplay = display === 'symbol-narrow' ? 'narrowSymbol'
      : display === 'code' ? 'code'
      : display === 'name' ? 'name'
      : 'symbol';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...digits,
    }).format(n);
  }
}
