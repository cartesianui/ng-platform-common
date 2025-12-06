

import { ValidatorFn } from '@angular/forms';
import { DateFormat } from '../services';

export type FormatterType = 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func';

export type FormatterOptions = {
  type: FormatterType;
  from?: DateFormat;
  to?: DateFormat;
  locale?: string;
  currency?: string;
  pattern?: string; // e.g. combo of two cols 'name (code)' or 'name'
  func?: (value: any, row?: any) => any;  // 👈 custom callable
}

export type FieldDescriptor = {
  key: string;
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