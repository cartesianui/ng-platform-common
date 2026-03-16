import { FormatterOptions } from './types';

/**
 * Formatter function signature.
 * Both built-in and custom formatters use this signature.
 */
export type FormatterFn = (
  target: 'db' | 'form' | 'dt',
  value: any,
  formatter: FormatterOptions,
  model: { getValue: (key: string) => any }
) => any;

/**
 * Static registry for all formatters (built-in and custom).
 * Built-in formatters (date, number, currency, func, multiline) are registered
 * during initialization. Libraries can register additional formatter types.
 *
 * @example
 * // Register in library initialization:
 * FormatterRegistry.register('age', (target, value, formatter, model) => {
 *   if (!value || target !== 'dt') return value;
 *   const birth = DatetimeService.fromISO(value);
 *   const years = Math.floor(DateTime.now().diff(birth, 'years').years);
 *   return `${years} yrs`;
 * });
 *
 * // Use in any model:
 * @EntityMeta({ list: [{ key: 'birth', label: 'Age', opt: { formatter: { type: 'age' } } }] })
 */
export class FormatterRegistry {
  private static formatters = new Map<string, FormatterFn>();

  static register(type: string, fn: FormatterFn): void {
    FormatterRegistry.formatters.set(type, fn);
  }

  static get(type: string): FormatterFn | undefined {
    return FormatterRegistry.formatters.get(type);
  }

  static has(type: string): boolean {
    return FormatterRegistry.formatters.has(type);
  }
}
