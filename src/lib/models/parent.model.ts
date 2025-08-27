import { FormControl, FormGroup, ValidatorFn } from '@angular/forms';
import { SearchForm } from '@cartesianui/core';
import Deserializable from './deserializeable.interface';
import { DatetimeService, DateFormat } from '../services';

export type FormatterType = 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func';

export interface FormatterOptions {
  type: FormatterType;
  from?: DateFormat;
  to?: DateFormat;
  locale?: string;
  currency?: string;
  pattern?: string; // e.g. combo of two cols 'name (code)' or 'name'
  func?: (value: any, row?: any) => any;  // 👈 custom callable
}

export interface FieldDescriptor {
  key: string;
  label: string;
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

export class ParentModel implements Deserializable {
  constructor(data?) {
    if (data) {
      if (data instanceof FormGroup) {
        this.fromForm(data);
      } else {
        this.init(data);
      }
    }
  }

  init(data?: Record<string, any>): this {
    return this.fromJSON(data);
  }

  clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  fromJSON(json?: Record<string, any>): this {
    if (json) {
      for (const property in json) {
        if (json.hasOwnProperty(property)) {
          (this as any)[property] = json[property];
        }
      }
    }
    return this;
  }

  toJSON(): Record<string, any> {
    const json: Record<string, any> = {};

    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        const value = (this as any)[key];
        if (typeof value !== 'function') {
          json[key] = value;
        }
      }
    }

    return json;
  }

  getValue(property) {
    return this.hasOwnProperty(property) ? this[property] ?? '' : property;
  }

  format(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
    const type = formatter?.type ?? '';
    switch (type) {
      case 'date':
        return this.evalDate(target, value, formatter);

      // TODO: use angular pipes so it get aware with locale
      case 'number':
        return new Intl.NumberFormat(formatter?.locale || 'en-US').format(Number(value));

      // TODO: use angular pipes so it get aware with locale
      case 'currency':
        return new Intl.NumberFormat(formatter?.locale || 'en-US', {
          style: 'currency',
          currency: formatter?.currency || 'USD'
        }).format(Number(value));

      // 👈 support callable
      case 'func':   
        if (typeof formatter.func === 'function') {
          return formatter.func(value, this);  // pass value + row/model
        }
        return value;

      default:
        return value;
    }
  }

  evalDate(target, value, formatter) {
    switch (target) {
      case 'dt':
        // INPUT: From API we always have UTC/ISO
        // OUPPUT: default is DateFormat.SHORT else provided in formatter
        if (formatter?.from) {
          return DatetimeService.fromFormat(value, formatter.from, formatter?.to ?? DateFormat.SHORT);
        } else {
          return DatetimeService.fromISO(value, formatter?.to ?? DateFormat.SHORT);
        }

      case 'form':
        // INPUT: From API we always have UTC/ISO
        // OUPPUT: default is DateFormat.SHORT else provided in formatter
        if (formatter?.from) {
          return DatetimeService.fromFormat(value, formatter.from, formatter?.to ?? DateFormat.SHORT);
        } else {
          return DatetimeService.fromISO(value, formatter?.to ?? DateFormat.SHORT);
        }

      case 'db':
        // INPUT: from FORM we can have
        //  - JS Date object, if bsDatepicker is touched
        //  - formatted date string in locale e.g.  DateFormat.SHORT in edit form but never changed
        // OUPPUT: always UTC/ISO

        // If the value is a JS Date (source form/bsDatepicker),
        // convert to Luxon DateTime | original
        if (value instanceof Date) {
          return DatetimeService.toApiDate(DatetimeService.fromJSDate(value));
        } else {
          // FOR NOW ONLY PARSE USER INPUT IN SHORT DATE FORMAT
          return DatetimeService.toApiDate(DatetimeService.parseUserInput(value));
        }

      default:
        return value;
    }
  }

  evalPattern(pattern: string): string {
    const cls = this.constructor as typeof ParentModel;

    return pattern.replace(/\b(\w+)\b/g, (key) => {
      const col = cls.getDataTableCol(key);
      const formatter = col?.opt?.formatter;
      const value = this.getValue(key);

      if (formatter && value !== undefined && value !== null) {
        return this.format(value, formatter);
      }
      return value ?? '';
    });
  }

  /**
   * Override this in subclasses to define field descriptors
   * form generation.
   */
  static formFields?: FieldDescriptor[] = [];

  toForm(patch?: Partial<this>): FormGroup {
    if (patch) {
      this.init(patch);
    }

    const formControls: { [key: string]: FormControl } = {};

    const rawFormFields: string[] | FieldDescriptor[] = (this.constructor as any).formFields ?? [];

    const formFields: FieldDescriptor[] = rawFormFields.map((field: any) => {
      if (typeof field === 'string') {
        // convert to FieldDescriptor
        return { key: field, label: field };
      }
      // already a FieldDescriptor
      return field;
    });

    const entries = formFields.map((field: any) => {
      const value = (this as any)[field.key] ?? null;
      return {
        key: field.key,
        label: field.label ?? field.key,
        value,
        opt: field.opt ?? {}
      };
    });

    for (const entry of entries) {
      formControls[entry.key] = new FormControl(this.formFormatted(entry) ?? null, entry?.opt?.validators ?? []);
    }

    const formGroup = new FormGroup(formControls);

    // TODO: THINK this will overwrite formatted values
    // if (patch) {
    //   formGroup.patchValue(patch);
    // }

    return formGroup;
  }

  fromForm(formGroup?: FormGroup): this {
    let json = formGroup.value;

    if (!json) return this;

    if (json) {
      this.init(json);
    }

    const rawFormFields: string[] | FieldDescriptor[] = (this.constructor as any).formFields ?? [];

    // Normalize formFields to FieldDescriptor[]
    const formFields: Record<string, FieldDescriptor> = Object.fromEntries(
      rawFormFields.map((field: any) => {
        const descriptor: FieldDescriptor = typeof field === 'string' ? { key: field, label: field } : field;
        return [descriptor.key, descriptor];
      })
    );

    for (const property in json) {
      if (!json.hasOwnProperty(property)) continue;

      let value = json[property];

      const descriptor = formFields[property];

      if (descriptor?.opt?.formatter) {
        value = this.dbFormatted(descriptor);
      }

      (this as any)[property] = value;
    }

    return this;
  }

  // To send to database
  dbFormatted(col: FieldDescriptor): string {
    let value = this.getValue(col.key);
    const formatter = col?.opt?.formatter;

    if (formatter && formatter?.type) {

      if (formatter?.type === 'func') {
        // 👈 call formatter with (value, row)
        return formatter?.func(value, this);
      } else if (formatter?.type == 'pattern') {
        // Case 1: display pattern for multiple fields
        return this.evalPattern(formatter.pattern);
      } else {
        // Case 2: single field with optional formatter
        if (value !== undefined && value !== null) {
          return this.format('db', value, formatter);
        }
      }
    }

    return value ?? '';
  }

  // To use in form
  formFormatted(col: FieldDescriptor): string {
    let value = this.getValue(col.key);
    const formatter = col?.opt?.formatter;

    if (formatter && formatter?.type) {
      if (formatter?.type === 'func') {
        // 👈 call formatter with (value, row)
        return formatter?.func(value, this);
      } else if (formatter?.type == 'pattern') {
        // Case 1: display pattern for multiple fields
        return this.evalPattern(formatter.pattern);
      } else {
        // Case 2: single field with optional formatter
        if (value !== undefined && value !== null) {
          return this.format('form', value, formatter);
        }
      }
    }

    return value ?? '';
  }

  /**
   * Override this in subclasses to define field descriptors
   * for data tables
   */
  static get dataTableCols(): FieldDescriptor[] {
    return [];
  }

  static getDataTableCols(): FieldDescriptor[] {
    return this.dataTableCols;
  }

  static getDataTableCol(key: string): FieldDescriptor | undefined {
    return (this as any).listViewFields?.find((field) => field.key === key);
  }

  static getDataTableHeaders(): { name: string; prop?: string }[] {
    return [
      { name: 'Select' },
      ...this.getDataTableCols().map((col) => ({
        name: this.readableName(col.label),
        prop: col.key
      }))
    ];
  }

  // For Datatable View
  dtFormatted(col: FieldDescriptor): string {
    let value = this.getValue(col.key);
    const formatter = col?.opt?.formatter;

    if (formatter && formatter?.type) {
      if (formatter?.type === 'func') {
        // 👈 call formatter with (value, row)
        return formatter?.func(value, this);
      } else if (formatter?.type == 'pattern') {
        // Case 1: display pattern for multiple fields
        return this.evalPattern(formatter.pattern);
      } else {
        // Case 2: single field with optional formatter
        if (value !== undefined && value !== null) {
          return this.format('dt', value, formatter);
        }
      }
    }

    return value ?? '';
  }

  static readableName(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }




  static get searchForm(): SearchForm {
    return {};
  };

  static getSearchForm(): SearchForm {
    return this.searchForm;
  }
}
