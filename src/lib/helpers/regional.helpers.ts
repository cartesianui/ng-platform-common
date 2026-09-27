import { DateTime } from 'luxon';

/**
 * Regional formatting helpers — direct utility functions (NOT formatter
 * registrations; those live in `formatter.utils.ts` and integrate with
 * the EntityMeta column/form pipeline).
 *
 * All read from `cartesian.regional.*` (the resolved tenant + user
 * regional block) with safe fallbacks. Mirrors the getter surface of
 * `RegionalService` but stays pure-function so it's usable from anywhere
 * (model formatters, plain TS, tests) without DI.
 *
 * Currency-specific helpers live in `currency.helpers.ts`. This file is
 * the date / timezone / locale-fallback layer.
 */

export const regionalLocale = (): string => (cartesian as any).regional?.locale ?? 'en-PK';
export const regionalCurrency = (): string => (cartesian as any).regional?.currency ?? 'PKR';
export const regionalTimeZone = (): string => (cartesian as any).regional?.timeZone ?? 'Asia/Karachi';

/**
 * Format an ISO / Date / DateTime value for display using one of the three
 * configured date-format variants on `cartesian.regional.dateFormat.*`.
 *
 * - `'short'`  → listing columns, badges
 * - `'medium'` → form inputs, detail views
 * - `'long'`   → headers, reports, formal documents
 *
 * Falls back to sensible patterns if `cartesian.regional` hasn't loaded.
 * Applies the tenant time zone for display.
 */
export function formatRegionalDate(
  value: string | Date | DateTime | null | undefined,
  variant: 'short' | 'medium' | 'long' = 'medium',
): string {
  if (value === null || value === undefined || value === '') return '';

  const dt = value instanceof DateTime
    ? value
    : value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromISO(String(value));

  if (!dt.isValid) return '';

  const reg = (cartesian as any).regional?.dateFormat;
  const pattern =
    variant === 'short'  ? (reg?.short  ?? 'dd/MM/yyyy') :
    variant === 'long'   ? (reg?.long   ?? 'EEEE, dd MMMM yyyy') :
                           (reg?.medium ?? 'dd MMM yyyy');

  return dt.setZone(regionalTimeZone()).setLocale(regionalLocale()).toFormat(pattern);
}

/**
 * Convert a value to a Luxon DateTime in the tenant's time zone. Use
 * when you need the DateTime object (for arithmetic, comparisons, etc.)
 * rather than a formatted string.
 */
export function convertToTenantTimezone(
  value: string | Date | DateTime,
): DateTime {
  const dt = value instanceof DateTime
    ? value
    : value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromISO(String(value));

  return dt.setZone(regionalTimeZone());
}