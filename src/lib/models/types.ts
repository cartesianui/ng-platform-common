

import { ValidatorFn } from '@angular/forms';
import { DateFormat } from '../services';

export type BuiltInFormatterType = 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func' | 'multiline';
export type FormatterType = BuiltInFormatterType | (string & {});

// Badge color options
export type BadgeColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light';

// Display style options for cell values (default: 'text')
export type DisplayStyle = 'text' | 'badge' | 'tag' | 'label' | 'muted';

// Custom value mapping configuration
// Maps raw values to display labels and optional colors
// Example: { 'pending': { label: 'Pending', color: 'warning' }, 'approved': { label: 'Approved', color: 'success' } }
export type ValueMapItem = {
  label: string;        // Display label for this value
  color?: BadgeColor;   // Optional badge color (used with badge/tag displayAs)
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
  separator?: 'br' | 'space' | 'none';  // How to separate lines (default: 'br')
  groupSeparator?: string;  // Separator between grouped items on same line (default: '|')
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
};

// Input type for EntityMeta search: accepts shorthand strings, full descriptors, or legacy format
export type SearchMetaInput = (string | SearchFieldDescriptor)[] | Record<string, any>;