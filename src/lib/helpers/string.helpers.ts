/**
 * Returns true if the given value is type of string
 *
 * @param val
 */
export function isString(x: any): x is string {
  return typeof x === 'string';
}


export const isUuid = (value: unknown): value is string => {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

/**
 * Returns converted string (from snake to camel)
 *
 * @param val
 */
export function toCamel(s) {
  return s.replace(/([-_][a-z0-9])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
}

/**
 * Returns converted string (from snake to camel)
 *
 * @param val
 */
export function toSnake(s) {
  return s.replace(/[A-Z]/g, (letter) => {
    return `_${letter?.toLowerCase()}`;
  });
}

/**
 * Capitalizes the first character in given string
 *
 * @param s
 */
export function capitalize(s: string) {
  if (!s || typeof s !== 'string') return s;
  return s && s[0].toUpperCase() + s.slice(1);
}

/**
 * Uncapitalizes the first character in given string
 *
 * @param s
 */
export function uncapitalize(s: string) {
  if (!s || typeof s !== 'string') return s;
  return s && s[0]?.toLowerCase() + s.slice(1);
}

/**
 * Convert a string into a human-readable format
 * Supports UPPER_CASE, camelCase, PascalCase, snake_case
 */
export interface ToLabelOptions {
  preserveAcronyms?: boolean; // true = keep fully uppercase words as-is
}

export function toLabel(str: string, options: ToLabelOptions = {}): string {
  if (!str) return '';

  const { preserveAcronyms = false } = options;

  // Handle snake_case or UPPER_CASE with underscores
  if (str.includes('_')) {
    return str
      .split('_')
      .map(word => {
        if (preserveAcronyms && word === word.toUpperCase()) {
          return word; // keep acronym
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // Handle camelCase / PascalCase — split on case transitions.
  // First regex: lower-to-upper transition (camelCase -> camel Case).
  // Second regex: acronym-to-word transition (HTTPRequest -> HTTP Request).
  const formatted = str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

  // Title-case EVERY word (parity with the snake_case branch above), not just
  // the first character — otherwise `tenantManagement` renders as
  // `'Tenant management'` instead of `'Tenant Management'`.
  return formatted
    .split(' ')
    .map(word => {
      if (!word) return word;
      if (preserveAcronyms && word === word.toUpperCase()) {
        return word; // keep acronym
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}