

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
  items?: FormatterOptions[];  // Nested formatters, each with its own key
  separator?: 'br' | 'space' | 'none';  // How to separate items (default: 'br')
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

// export interface Deserializable {
//   init(input: any): this;
//   fromJSON(input: any): this;
//   toJSON():  Record<string, any>;
//   clone(): this;
// }