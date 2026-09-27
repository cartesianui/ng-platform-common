

import { ValidatorFn } from '@angular/forms';
import { DateFormat } from '../services';

export type BuiltInFormatterType = 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func' | 'multiline';
export type FormatterType = BuiltInFormatterType | (string & {});

// Badge color options
export type BadgeColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light';

// Display style options for cell values (default: 'text')
export type DisplayStyle = 'text' | 'badge' | 'tag' | 'label' | 'muted' | 'bracket';

// Custom value mapping configuration
// Maps raw values to display labels, optional colors, and optional icons
// Example: { 'pending': { label: 'Pending', color: 'warning', icon: 'fa-clock' } }
export type ValueMapItem = {
  label: string;        // Display label for this value
  color?: BadgeColor;   // Optional badge color (used with badge/tag displayAs)
  icon?: string;        // Optional icon class (e.g. 'fa-check') prepended to the label
};

export type ValueMap = {
  [key: string]: ValueMapItem | string;  // Can be full config or just a label string
};

export type FormatterOptions = {
  // Field key (used in multiline items to specify which field to format)
  key?: string;
  type?: FormatterType;
  from?: DateFormat;
  to?: DateFormat;
  locale?: string;
  currency?: string;
  pattern?: string; // e.g. combo of two cols 'name (code)' or 'name'
  func?: (value: any, row?: any) => any;  // 👈 custom callable
  // Single value display options
  displayAs?: DisplayStyle;  // Display style for single value (text, badge, tag, label, muted)
  badgeColor?: BadgeColor;   // For badge/tag display style
  class?: string;            // Optional custom CSS class
  prefix?: string;           // Optional prefix text
  suffix?: string;           // Optional suffix text
  // Custom value mapping (for enums, status fields, booleans, etc.)
  valueMap?: ValueMap;       // Maps raw values to labels and colors
  // Multiline formatter options (type: 'multiline')
  // Each item can be a single FormatterOptions or an array of FormatterOptions (grouped on same line)
  items?: (FormatterOptions | FormatterOptions[])[];
  // Rendered only when every `items[].key` resolves to empty/null on the row.
  // Used for conditional cells (e.g. registered customer vs walk-in name/phone).
  fallbackItems?: (FormatterOptions | FormatterOptions[])[];
  // Static text rendered when BOTH `items` and `fallbackItems` are empty.
  // Wrapped in a muted span so it visually reads as "no data" rather than
  // a real value (e.g. "N/A" on a Source col for direct-entry vouchers).
  defaultText?: string;
  separator?: 'br' | 'space' | 'none';  // How to separate lines (default: 'br')
  groupSeparator?: string;  // Separator between grouped items on same line (default: '|')
  // Tooltip affordance — when set, the rendered cell is wrapped with an
  // info-icon trigger that reveals a styled popup on hover OR click
  // (`:focus-visible` via the focusable trigger button). The popup text
  // comes from this key (dot-paths supported). Useful for showing
  // extended context on hover without bloating the cell — e.g. single
  // doc number in cell, full chain on hover.
  tooltipKey?: string;
  // Optional small dimmed header rendered inside the tooltip popup,
  // above the value. Self-identifies the popup, e.g. "Source chain".
  tooltipLabel?: string;
  // Bootstrap theme variant for the tooltip — drives icon shape +
  // accent color. Defaults to `info`. Add cases here as new themes
  // gain semantic meaning across the app.
  tooltipTheme?: 'info' | 'success' | 'warning' | 'danger';
  // Image-formatter-only options (type: 'image')
  preview?: boolean;        // Enable hover preview (default: true)
  previewSize?: 'xs' | 'passport' | 'avatar' | 'small' | 'medium' | 'large' | 'product';  // Preview preset (default: 'medium')
  // Copy-formatter-only options (type: 'copy')
  length?: number;      // Truncate displayed text to this many chars + '…'; the full value is still what gets copied.
  showValue?: boolean;  // false to render icon-only, no value text (default: true) — for grouping into another column's stack.
}

export type FieldDescriptor = {
  key: string;
  dataKey?: string;
  label: string;
  defaultValue?: any;
  opt?: {
    link?: boolean;
    width?: string; // e.g. '150'
    formatter?: FormatterOptions;
    validators?: ValidatorFn[];
    required?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    [prop: string]: any;
  };
}

// ─── Search Field Descriptors ───────────────────────────────────────────────

export type SearchFieldType = 'text' | 'select' | 'entity' | 'date' | 'daterange' | 'number' | 'boolean';

export type SearchFieldDescriptor = {
  key: string;              // camelCase field name (maps to WhereItem.column)
  label?: string;           // Display label (auto-generated from key if omitted)
  operator?: string;        // '=' | 'like' | 'between' | 'in' (default: '=')
  type?: SearchFieldType;   // UI control type (default: 'text')
  // Entity lookup options (when type: 'entity')
  url?: string;             // API endpoint for selectable-control
  optionField?: string;     // Display field (default: 'name')
  optionKey?: string;       // Value field (default: 'id')
  // Select options (when type: 'select')
  options?: { label?: string; name?: string; value: string }[];
  // General
  placeholder?: string;
  hidden?: boolean;         // Include in criteria but don't show in UI
  width?: string;           // CSS col width hint (e.g. '2' for col-2, '3' for col-3)
  /**
   * Default value applied on init when the field has no hydrated value (URL/state).
   * - For `type: 'date'`: literal `Date | string` (ISO `YYYY-MM-DD`) OR a sentinel
   *   `'today' | 'yesterday' | 'tomorrow'` resolved at init time.
   * - For `type: 'daterange'`: literal `[Date|string, Date|string]` OR sentinel
   *   `'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'`.
   * - For other types: literal value to seed the control.
   * The default is applied as a real filter, not a placeholder — first render
   * fires the corresponding `criteria.where` so the listing shows the
   * defaulted slice immediately.
   */
  defaultValue?: any;
};

// Input type for EntityMeta search: accepts shorthand strings, full descriptors, or legacy format
export type SearchMetaInput = (string | SearchFieldDescriptor)[] | Record<string, any>;