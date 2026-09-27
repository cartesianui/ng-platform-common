import { Injectable } from '@angular/core';
import { DateTime, DateTimeOptions, Settings as DateTimeSettings } from 'luxon';

export enum DateFormat {
  /**
   * Locale-aware short date
   * Example (en-US): 8/17/2025
   * Example (fr-FR): 17/08/2025
   */
  SHORT = 'DATE_SHORT',

  /**
   * Locale-aware medium date
   * Example: Aug 17, 2025
   */
  MED = 'DATE_MED',

  /**
   * Locale-aware full date
   * Example: Sunday, August 17, 2025
   */
  FULL = 'DATE_FULL',

  /**
   * Locale-aware short time
   * Example: 1:45 PM
   */
  TIME = 'TIME_SIMPLE',

  /**
   * Locale-aware time with seconds
   * Example: 1:45:30 PM
   */
  TIME_WITH_SECONDS = 'TIME_WITH_SECONDS',

  /**
   * Locale-aware short date and time
   * Example: 8/17/2025, 1:45 PM
   */
  DATETIME_SHORT = 'DATETIME_SHORT',

  /**
   * Locale-aware medium date and time
   * Example: Aug 17, 2025, 1:45 PM
   */
  DATETIME_MED = 'DATETIME_MED',

  /**
   * Locale-aware full date and time
   * Example: Sunday, August 17, 2025 at 1:45 PM
   */
  DATETIME_FULL = 'DATETIME_FULL',

  /**
   * Locale-aware full date and time with seconds and time zone
   * Example: Sunday, August 17, 2025 at 1:45:30 PM GMT+2
   */
  DATETIME_HUGE = 'DATETIME_HUGE',

  /**
   * Fixed DB-safe format (non-locale-aware)
   * Example: 2025-08-17 13:45:30
   */
  DB = 'yyyy-MM-dd HH:mm:ss',

  /**
   * ISO 8601 format (non-locale-aware)
   * Example: 2025-08-17T13:45:30.000Z
   */
  ISO = 'ISO',

  /**
   * Custom example: long weekday + full date (object style)
   * Example: Sunday, August 17, 2025
   */
  WEEKDAY_LONG = 'WEEKDAY_LONG'
}

@Injectable({
  providedIn: 'root'
})
export class DatetimeService {
  private static get luxonOptions(): DateTimeOptions {
    return {
      locale: DateTimeSettings.defaultLocale,
      zone: DateTimeSettings.defaultZone
    };
  }

  static fromFormat(date, inputFormat: string, outputFormat?: DateFormat): DateTime | any {
    return DatetimeService.format(DateTime.fromFormat(date, inputFormat), outputFormat);
  }

  /**
   *
   * @param date
   * @param format
   * @returns
   */
  static fromSql(date, format?: DateFormat): DateTime | any {
    return DatetimeService.format(DateTime.fromSQL(date), format);
  }

  static fromISO(date, format?: DateFormat): DateTime | any {
    return DatetimeService.format(DateTime.fromISO(date), format);
  }

  static fromMillis(date, format?: DateFormat): DateTime | any {
    return DatetimeService.format(DateTime.fromMillis(date), format);
  }

  static fromJSDate(date: Date) {
    return DateTime.fromJSDate(date);
  }

  static now(format?): DateTime | any {
    return DatetimeService.format(DateTime.now(), format);
  }

  static toISO(date: string) {
    return DatetimeService.fromISO(date).toISO();
  }

  static toJSDate(date: string) {
    return DatetimeService.fromISO(date).toJSDate();
  }

  static toLocal(date: string) {
    return DatetimeService.fromISO(date).toLocaleString();
  }

  /**
   * Serialize a Luxon DateTime as the BE-facing calendar-day string
   * (`YYYY-MM-DD`) using the **tenant time zone**, not UTC.
   *
   * Why not `toUTC().toISO()` (the previous shape):
   * For a date-only field like `expiry_date`, the FE loads `'2028-05-13'`
   * → Luxon parses as PKT midnight → JS Date instant `2028-05-12T19:00:00Z`.
   * On save, `toUTC().toISO()` produces `'2028-05-12T19:00:00.000Z'`; the
   * BE truncates the time component **using UTC** and persists `2028-05-12`
   * — one calendar day before what the user actually saw / picked.
   *
   * Reading the calendar day off the tenant-zoned DateTime instead keeps
   * the round-trip stable: load `'2028-05-13'` → display 13 → save `'2028-05-13'`.
   * Matches the canonicalization the `formatDate('db', ...)` formatter
   * already uses on the `parseUserInput` branch.
   */
  public static toApiDate(date: DateTime): string {
    return date.setZone(DateTimeSettings.defaultZone).toFormat('yyyy-MM-dd');
  }

  static timeSince(start: string, precision: 'years' | 'months' | 'days' = 'years'): string {
    let today = DateTime.now();
    let startDate = DateTime.fromISO(start);

    let duration: any = today.diff(startDate);
    let days, months, years: string;

    let html: string = '';
    switch (precision) {
      case 'days':
        // Note: Going one unit lower give us integer/rounded values
        duration = duration.shiftTo('years', 'months', 'days', 'hours');
        days = duration.days.toString();
        months = duration.months.toString();
        years = duration.years.toString();

        html += [years, 'years', months, 'months', days, 'days'].join(' ');
        break;
      case 'months':
        duration = duration.shiftTo('years', 'months', 'days');

        months = duration.months.toString();
        years = duration.years.toString();

        html += [years, 'years', months, 'months'].join(' ');
        break;
      default:
        // years
        duration = duration.shiftTo('years', 'months');

        years = duration.years.toString();

        // Do not display unit when only years
        html += years;
        break;
    }

    return html;
  }

  static toRelative(date: string): string | null {
    return DateTime.fromISO(date).toRelative(); // e.g., "2 days ago"
  }

  static fromNow(days: number): DateTime {
    return DateTime.now().plus({ days });
  }

  // ─── Calendar-relative helpers (used by search defaults, schedulers etc.) ──
  // All return a `DateTime` at start-of-day in the configured zone.

  static today(): DateTime {
    return DateTime.now().startOf('day');
  }

  static yesterday(): DateTime {
    return DatetimeService.today().minus({ days: 1 });
  }

  static tomorrow(): DateTime {
    return DatetimeService.today().plus({ days: 1 });
  }

  /** Sunday-anchored week (matches the search-panel sentinel semantics). */
  static startOfThisWeek(): DateTime {
    const t = DatetimeService.today();
    return t.minus({ days: t.weekday % 7 }); // luxon weekday: 1..7 (Mon..Sun) → 0..6 with Sun=0
  }

  static endOfThisWeek(): DateTime {
    return DatetimeService.startOfThisWeek().plus({ days: 6 });
  }

  static startOfLastWeek(): DateTime {
    return DatetimeService.startOfThisWeek().minus({ weeks: 1 });
  }

  static endOfLastWeek(): DateTime {
    return DatetimeService.startOfThisWeek().minus({ days: 1 });
  }

  static startOfThisMonth(): DateTime {
    return DatetimeService.today().startOf('month');
  }

  static endOfThisMonth(): DateTime {
    return DatetimeService.today().endOf('month').startOf('day');
  }

  static startOfLastMonth(): DateTime {
    return DatetimeService.startOfThisMonth().minus({ months: 1 });
  }

  static endOfLastMonth(): DateTime {
    return DatetimeService.startOfThisMonth().minus({ days: 1 });
  }

  /**
   * Resolve a date sentinel string to a DateTime at start-of-day. Single
   * source of truth for the sentinel vocabulary shared across form-default
   * values and listing search panels — adding a new sentinel here makes it
   * available everywhere.
   *
   * Recognized sentinels: `'today'`, `'yesterday'`, `'tomorrow'`.
   * Returns null for any other input (including ISO strings, Date instances,
   * non-strings) — callers handle those cases on their own.
   */
  static resolveSentinel(input: any): DateTime | null {
    if (typeof input !== 'string') return null;
    switch (input) {
      case 'today':     return DatetimeService.today();
      case 'yesterday': return DatetimeService.yesterday();
      case 'tomorrow':  return DatetimeService.tomorrow();
      default:          return null;
    }
  }

  /** ISO date `YYYY-MM-DD`, no time. */
  static toIsoDate(dt: DateTime): string {
    return dt.toISODate() ?? '';
  }

  static format(dt: DateTime, format?: DateFormat): DateTime | string {
    if (!format) return dt;

    switch (format) {
      // Locale-aware formats using Luxon constants
      case DateFormat.SHORT:
        return dt.toLocaleString(DateTime.DATE_SHORT);
      case DateFormat.MED:
        return dt.toLocaleString(DateTime.DATE_MED);
      case DateFormat.FULL:
        return dt.toLocaleString(DateTime.DATE_FULL);
      case DateFormat.TIME:
        return dt.toLocaleString(DateTime.TIME_SIMPLE);
      case DateFormat.TIME_WITH_SECONDS:
        return dt.toLocaleString(DateTime.TIME_WITH_SECONDS);
      case DateFormat.DATETIME_SHORT:
        return dt.toLocaleString(DateTime.DATETIME_SHORT);
      case DateFormat.DATETIME_MED:
        return dt.toLocaleString(DateTime.DATETIME_MED);
      case DateFormat.DATETIME_FULL:
        return dt.toLocaleString(DateTime.DATETIME_FULL);
      case DateFormat.DATETIME_HUGE:
        return dt.toLocaleString(DateTime.DATETIME_HUGE);

      // Custom object format (weekday + long date)
      case DateFormat.WEEKDAY_LONG:
        return dt.toLocaleString({
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

      // ISO 8601 format
      case DateFormat.ISO:
        return dt.toISO();

      // Custom fixed format (e.g., for DB)
      case DateFormat.DB:
        return dt.toFormat(DateFormat.DB);

      // Fallback — return original DateTime
      default:
        return dt;
    }
  }

  static valid(date: string): boolean {
    return DatetimeService.fromISO(date).isValid;
  }

  static isGreater(date: string, minDate: string, boundry: boolean = false): boolean {
    return boundry ? DatetimeService.fromISO(date) > DatetimeService.fromISO(minDate) : DatetimeService.fromISO(date) >= DatetimeService.fromISO(minDate);
  }

  static isLess(date: string, maxDate: string, boundry: boolean = false): boolean {
    return boundry ? DatetimeService.fromISO(date) < DatetimeService.fromISO(maxDate) : DatetimeService.fromISO(date) <= DatetimeService.fromISO(maxDate);
  }

  static inDateRange(date: string, minDate: string, maxDate: string, boundry: boolean = false): boolean {
    return DatetimeService.isGreater(date, minDate, boundry) && DatetimeService.isLess(date, maxDate, boundry);
  }

  static getShortDateFormat(): string {
    const locale = this.luxonOptions.locale || 'en-US';
    const sampleDate = new Date(Date.UTC(2025, 7, 9)); // August 9, 2025

    const parts = new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).formatToParts(sampleDate);

    return parts
      .map((part) => {
        switch (part.type) {
          case 'day':
            return 'dd';
          case 'month':
            return 'MM';
          case 'year':
            return part.value.length === 2 ? 'yy' : 'yyyy';
          default:
            return part.value;
        }
      })
      .join('');
  }

  static getShortDateFormatForDatePicker(): string {
    // const dateInputFormats: { [lang: string]: string } = {
    //     en: 'MM/DD/YYYY',           // English - US style
    //     pk: 'DD/MM/YYYY',           // Pakistan - Day first
    //     fr: 'DD MMMM YYYY',         // French - Long month names
    //     de: 'DD.MM.YYYY',           // German - Dots instead of slashes
    //     es: 'DD/MM/YYYY',           // Spanish
    //     it: 'DD/MM/YYYY',           // Italian
    //     zh: 'YYYY/MM/DD',           // Chinese
    //     ja: 'YYYY年MM月DD日',        // Japanese (with native characters)
    //     ar: 'DD/MM/YYYY',           // Arabic
    //     ru: 'DD.MM.YYYY'            // Russian
    // };
    const locale = this.luxonOptions.locale || 'en-US';
    const sampleDate = new Date(Date.UTC(2025, 7, 9)); // August 9, 2025

    const parts = new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).formatToParts(sampleDate);

    return parts
      .map((part) => {
        switch (part.type) {
          case 'day':
            return 'DD';
          case 'month':
            return 'MM';
          case 'year':
            return part.value.length === 2 ? 'YY' : 'YYYY';
          default:
            return part.value;
        }
      })
      .join('');
  }

  static parseUserInput(input: string): DateTime | null {
    const format = this.getShortDateFormat();
    const dt = DateTime.fromFormat(input, format, this.luxonOptions);
    return dt.isValid ? dt : null;
  }
}
