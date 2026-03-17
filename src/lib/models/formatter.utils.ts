import { DatetimeService, DateFormat } from '../services';
import { FormatterOptions, BadgeColor } from './types';
import { FormatterRegistry } from './formatter.registry';

/**
 * Format date value based on target context
 */
export function formatDate(
  target: 'db' | 'form' | 'dt',
  value: any,
  formatter?: FormatterOptions
): any {
  try {
    switch (target) {
      case 'form':
        if (value instanceof Date) return value;
        if (formatter?.from) {
          return DatetimeService.fromFormat(value, formatter.from).toJSDate();
        } else {
          return DatetimeService.fromISO(value).toJSDate();
        }

      case 'dt':
        if (formatter?.from) {
          return DatetimeService.fromFormat(value, formatter.from, formatter?.to ?? DateFormat.SHORT);
        } else {
          return DatetimeService.fromISO(value, formatter?.to ?? DateFormat.SHORT);
        }

      case 'db':
        if (value instanceof Date) {
          return DatetimeService.toApiDate(DatetimeService.fromJSDate(value));
        } else {
          return DatetimeService.toApiDate(DatetimeService.parseUserInput(value));
        }

      default:
        return value;
    }
  } catch (error) {
    console.error(`[formatter.formatDate] Error formatting date for target="${target}"`, {
      value,
      valueType: typeof value,
      isDate: value instanceof Date,
      formatter,
      error
    });
    return value;
  }
}

/**
 * Format multiline content - renders multiple fields with different display styles
 * Each item is a FormatterOptions with a 'key' to specify the field
 */
export function formatMultiline(
  formatter: FormatterOptions | undefined,
  model: { getValue: (key: string) => any }
): string {
  if (!formatter?.items || !Array.isArray(formatter.items)) {
    return '';
  }

  const separator = formatter.separator ?? 'br';
  const separatorHtml = separator === 'br' ? '<br>' : separator === 'space' ? ' ' : '';

  const parts: string[] = [];

  for (const item of formatter.items) {
    try {
      if (!item.key) continue;

      let value = model.getValue(item.key);
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Apply type-based formatting (date, number, currency) before display styling
      if (item.type && item.type !== 'multiline') {
        const typeFn = FormatterRegistry.get(item.type);
        if (typeFn) {
          value = typeFn('dt', value, item, model);
        }
      }

      const html = wrapWithDisplayStyle(value, item);
      if (html) {
        parts.push(html);
      }
    } catch (error) {
      console.error(`[formatter.formatMultiline] Error processing item key="${item.key}"`, {
        item,
        error
      });
    }
  }

  return parts.join(separatorHtml);
}

/**
 * Evaluate pattern - replaces field keys in pattern with formatted values
 * @param pattern - Pattern string like 'name (code)' or 'firstName lastName'
 * @param model - Model instance with getValue method
 * @param getFormatter - Function to get formatter for a field key
 */
export function evalPattern(
  pattern: string,
  model: { getValue: (key: string) => any },
  getFormatter?: (key: string) => FormatterOptions | undefined
): string {
  try {
    return pattern.replace(/\b(\w+)\b/g, (key) => {
      try {
        const value = model.getValue(key);
        const formatter = getFormatter?.(key);

        if (formatter && value !== undefined && value !== null) {
          return formatValue('dt', value, formatter, model);
        }
        return value ?? '';
      } catch (error) {
        console.error(`[formatter.evalPattern] Error processing key="${key}"`, { key, pattern, error });
        return '';
      }
    });
  } catch (error) {
    console.error(`[formatter.evalPattern] Error evaluating pattern="${pattern}"`, { pattern, error });
    return pattern;
  }
}

/**
 * Wrap a single value with display style HTML
 * Handles valueMap, prefix/suffix, and display styles (badge, tag, muted, etc.)
 */
export function wrapWithDisplayStyle(value: any, formatter: FormatterOptions): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  let displayValue: string;
  let badgeColor: BadgeColor = formatter.badgeColor ?? 'secondary';

  // Check for valueMap (custom value mapping for enums, statuses, booleans, etc.)
  const stringValue = String(value);
  if (formatter.valueMap && formatter.valueMap[stringValue]) {
    const mapped = formatter.valueMap[stringValue];
    if (typeof mapped === 'string') {
      displayValue = mapped;
    } else {
      displayValue = mapped.label;
      if (mapped.color) {
        badgeColor = mapped.color;
      }
    }
  } else {
    displayValue = `${formatter.prefix ?? ''}${value}${formatter.suffix ?? ''}`;
  }

  const customClass = formatter.class ? ` ${formatter.class}` : '';
  const style = formatter.displayAs ?? 'text';

  switch (style) {
    case 'muted':
      return `<small class="text-muted${customClass}">${displayValue}</small>`;
    case 'badge':
      return `<span class="badge bg-${badgeColor}${customClass}">${displayValue}</span>`;
    case 'tag':
      return `<span class="badge rounded-pill bg-${badgeColor}${customClass}">${displayValue}</span>`;
    case 'label':
      return `<strong class="${customClass}">${displayValue}</strong>`;
    case 'text':
    default:
      return customClass ? `<span class="${customClass}">${displayValue}</span>` : displayValue;
  }
}

/**
 * Format a value based on formatter options and target context.
 * Dispatches to the FormatterRegistry which holds both built-in and custom formatters.
 */
export function formatValue(
  target: 'db' | 'form' | 'dt',
  value: any,
  formatter: FormatterOptions | undefined,
  model: { getValue: (key: string) => any }
): any {
  const type = formatter?.type ?? '';
  try {
    // Look up formatter in registry (built-in + custom)
    const registeredFn = FormatterRegistry.get(type);
    if (registeredFn) {
      return registeredFn(target, value, formatter!, model);
    }

    // Fallback: handle displayAs for single values without a specific type
    if (formatter?.displayAs && target === 'dt') {
      return wrapWithDisplayStyle(value, formatter);
    }
    return value;
  } catch (error) {
    console.error(`[formatter.formatValue] Error formatting value for target="${target}", type="${type}"`, {
      value,
      formatter,
      error
    });
    return value;
  }
}

// ─── Register built-in formatters ───────────────────────────────────────────

FormatterRegistry.register('date', (target, value, formatter) => {
  return formatDate(target, value, formatter);
});

FormatterRegistry.register('number', (_target, value, formatter) => {
  return new Intl.NumberFormat(formatter?.locale || 'en-US').format(Number(value));
});

FormatterRegistry.register('currency', (_target, value, formatter) => {
  return new Intl.NumberFormat(formatter?.locale || 'en-US', {
    style: 'currency',
    currency: formatter?.currency || 'USD'
  }).format(Number(value));
});

FormatterRegistry.register('func', (_target, value, formatter, model) => {
  if (typeof formatter?.func === 'function') {
    return formatter.func(value, model);
  }
  return value;
});

FormatterRegistry.register('multiline', (_target, _value, formatter, model) => {
  return formatMultiline(formatter, model);
});
