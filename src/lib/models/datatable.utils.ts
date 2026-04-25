import { FieldDescriptor } from './types';
import { formatValue } from './formatter.utils';
import { IValueProvider } from './form.utils';

/**
 * Format value for datatable display
 */
export function formatForDataTable(
  model: IValueProvider,
  col: FieldDescriptor,
  evalPattern: (pattern: string) => string
): any {
  try {
    let value = model.getValue(col.dataKey || col.key);
    const formatter = col?.opt?.formatter;

    if (formatter?.type) {
      if (formatter.type === 'func') {
        return formatter?.func?.(value, model);
      } else if (formatter.type === 'pattern') {
        return evalPattern(formatter.pattern!);
      } else if (formatter.type === 'multiline') {
        // multiline resolves each item's key independently and may render
        // fallbackItems when the column's primary key is null — run unconditionally.
        return formatValue('dt', value, formatter, model);
      } else {
        if (value !== undefined && value !== null) {
          return formatValue('dt', value, formatter, model);
        }
      }
    } else if (formatter?.displayAs) {
      // Handle displayAs without a type (e.g., badge for values)
      if (value !== undefined && value !== null) {
        return formatValue('dt', value, formatter, model);
      }
    }

    return value ?? '';
  } catch (error) {
    console.error(`[datatable.formatForDataTable] Error formatting field="${col.key}"`, {
      field: col,
      value: model.getValue(col.dataKey || col.key),
      error
    });
    return model.getValue(col.dataKey || col.key) ?? '';
  }
}

/**
 * Get datatable column headers with Select column
 */
export function getHeaders(
  dataTableCols: FieldDescriptor[],
  readableName: (key: string) => string
): { name: string; prop?: string }[] {
  return [
    { name: 'Select' },
    ...dataTableCols.map((col) => ({
      name: readableName(col.label),
      prop: col.key
    }))
  ];
}

/**
 * Convert camelCase/PascalCase to readable name
 */
export function toReadableName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}