import { FormControl, FormGroup } from '@angular/forms';
import { SearchForm } from '@cartesianui/core';
import { FieldDescriptor, FormatterOptions } from './types';
import { DatetimeService, DateFormat } from '../services';


export class BaseModel {

  constructor(data?: Record<string, any> | FormGroup) {
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
        if (Object.prototype.hasOwnProperty.call(json, property)) {
          (this as any)[property] = json[property];
        }
      }
    }
    return this;
  }

  toJSON(): Record<string, any> {
    const json: Record<string, any> = {};

    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = (this as any)[key];
        if (typeof value !== 'function') {
          json[key] = value;
        }
      }
    }

    return json;
  }

  getValue(property: string): any {
    return Object.prototype.hasOwnProperty.call(this, property) ? this[property] : null;
  }

  format(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
    const type = formatter?.type ?? '';
    try {
      switch (type) {
        case 'date':
          return this.evalDate(target, value, formatter);

        // TODO: use angular pipes so it gets aware with locale
        case 'number':
          return new Intl.NumberFormat(formatter?.locale || 'en-US').format(Number(value));

        // TODO: use angular pipes so it gets aware with locale
        case 'currency':
          return new Intl.NumberFormat(formatter?.locale || 'en-US', {
            style: 'currency',
            currency: formatter?.currency || 'USD'
          }).format(Number(value));

        // 👈 support callable
        case 'func':
          if (typeof formatter?.func === 'function') {
            return formatter.func(value, this);  // pass value + row/model
          }
          return value;

        default:
          return value;
      }
    } catch (error) {
      console.error(`[BaseModel.format] Error formatting value for target="${target}", type="${type}"`, {
        value,
        formatter,
        model: this.constructor.name,
        error
      });
      return value; // Return original value on error
    }
  }

  evalDate(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
    try {
      switch (target) {
        case 'dt':
          // INPUT: From API we always have UTC/ISO
          // OUTPUT: default is DateFormat.SHORT else provided in formatter
          if (formatter?.from) {
            return DatetimeService.fromFormat(value, formatter.from, formatter?.to ?? DateFormat.SHORT);
          } else {
            return DatetimeService.fromISO(value, formatter?.to ?? DateFormat.SHORT);
          }

        case 'form':
          // INPUT: From API we always have UTC/ISO
          // OUTPUT: default is DateFormat.SHORT else provided in formatter
          if (formatter?.from) {
            return DatetimeService.fromFormat(value, formatter.from, formatter?.to ?? DateFormat.SHORT);
          } else {
            return DatetimeService.fromISO(value, formatter?.to ?? DateFormat.SHORT);
          }

        case 'db':
          // INPUT: from FORM we can have
          //  - JS Date object, if bsDatepicker is touched
          //  - formatted date string in locale e.g.  DateFormat.SHORT in edit form but never changed
          // OUTPUT: always UTC/ISO

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
    } catch (error) {
      console.error(`[BaseModel.evalDate] Error evaluating date for target="${target}"`, {
        value,
        valueType: typeof value,
        isDate: value instanceof Date,
        formatter,
        model: this.constructor.name,
        error
      });
      return value; // Return original value on error
    }
  }

  evalPattern(pattern: string): string {
    const cls = this.constructor as typeof BaseModel;

    try {
      return pattern.replace(/\b(\w+)\b/g, (key) => {
        try {
          const col = cls.getDataTableCol(key);
          const formatter = col?.opt?.formatter;
          const value = this.getValue(key);

          if (formatter && value !== undefined && value !== null) {
            return this.format('dt', value, formatter);
          }
          return value ?? '';
        } catch (error) {
          console.error(`[BaseModel.evalPattern] Error processing key="${key}" in pattern="${pattern}"`, {
            key,
            pattern,
            model: this.constructor.name,
            error
          });
          return ''; // Return empty string for failed key
        }
      });
    } catch (error) {
      console.error(`[BaseModel.evalPattern] Error evaluating pattern="${pattern}"`, {
        pattern,
        model: this.constructor.name,
        error
      });
      return pattern; // Return original pattern on error
    }
  }

  /**
   * Override this in subclasses to define field descriptors
   * form generation.
   * Example
   * static override formFields?: FieldDescriptor[] = [
   *   { key: 'name', label: 'Name', opt: { validators: [Validators.required, Validators.minLength(3)] } },
   *   { key: 'openingBalance', label: 'Opening Bal' },
   *   { key: 'code', label: 'Code' },
   *   { key: 'openedAt', label: 'Opened At', opt: { formatter: { type: 'date'} } },
   * ];
   */
  static formFields?: FieldDescriptor[] = [];

  toForm(patch?: Partial<this>): FormGroup {
    try {
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
        const value = (this as any)[field.key] ?? (field.defaultValue ?? null);
        return {
          key: field.key,
          label: field.label ?? field.key,
          defaultValue: value,
          opt: field.opt ?? {}
        };
      });

      for (const entry of entries) {
        try {
          formControls[entry.key] = new FormControl(this.formFormatted(entry) ?? null, entry?.opt?.validators ?? []);
        } catch (error) {
          console.error(`[BaseModel.toForm] Error creating form control for field="${entry.key}"`, {
            field: entry,
            model: this.constructor.name,
            error
          });
          // Create control with raw value as fallback
          formControls[entry.key] = new FormControl(entry.defaultValue ?? null, entry?.opt?.validators ?? []);
        }
      }

      const formGroup = new FormGroup(formControls);

      // TODO: THINK this will overwrite formatted values
      // if (patch) {
      //   formGroup.patchValue(patch);
      // }

      return formGroup;
    } catch (error) {
      console.error(`[BaseModel.toForm] Error creating form group`, {
        model: this.constructor.name,
        patch,
        error
      });
      // Return empty form group as fallback
      return new FormGroup({});
    }
  }

  fromForm(formGroup?: FormGroup): this {
    if (!formGroup) return this;

    try {
      const json = formGroup.value;

      if (!json) return this;

      this.init(json);

      const rawFormFields: string[] | FieldDescriptor[] = (this.constructor as any).formFields ?? [];

      // Normalize formFields to FieldDescriptor[]
      const formFields: Record<string, FieldDescriptor> = Object.fromEntries(
        rawFormFields.map((field: any) => {
          const descriptor: FieldDescriptor = typeof field === 'string' ? { key: field, label: field } : field;
          return [descriptor.key, descriptor];
        })
      );

      for (const property in json) {
        if (!Object.prototype.hasOwnProperty.call(json, property)) continue;

        try {
          let value = json[property];

          const descriptor = formFields[property];

          if (descriptor?.opt?.formatter) {
            value = this.dbFormatted(descriptor);
          }

          (this as any)[property] = value;
        } catch (error) {
          console.error(`[BaseModel.fromForm] Error processing field="${property}"`, {
            property,
            value: json[property],
            descriptor: formFields[property],
            model: this.constructor.name,
            error
          });
          // Keep original value on error
          (this as any)[property] = json[property];
        }
      }

      return this;
    } catch (error) {
      console.error(`[BaseModel.fromForm] Error converting form to model`, {
        model: this.constructor.name,
        error
      });
      return this;
    }
  }

  // To send to database
  dbFormatted(col: FieldDescriptor): any {
    try {
      let value = this.getValue(col.key);
      const formatter = col?.opt?.formatter;

      if (formatter?.type) {
        if (formatter.type === 'func') {
          // 👈 call formatter with (value, row)
          return formatter?.func?.(value, this);
        } else if (formatter.type === 'pattern') {
          // Case 1: display pattern for multiple fields
          return this.evalPattern(formatter.pattern!);
        } else {
          // Case 2: single field with optional formatter
          if (value !== undefined && value !== null) {
            return this.format('db', value, formatter);
          }
        }
      }

      return value ?? '';
    } catch (error) {
      console.error(`[BaseModel.dbFormatted] Error formatting field="${col.key}" for database`, {
        field: col,
        value: this.getValue(col.key),
        model: this.constructor.name,
        error
      });
      return this.getValue(col.key) ?? ''; // Return raw value on error
    }
  }

  // To use in form
  formFormatted(col: FieldDescriptor): any {
    try {
      let value = this.getValue(col.key);

      if (value === null && col.defaultValue !== undefined) {
        value = col.defaultValue;
      }

      const formatter = col?.opt?.formatter;

      if (formatter?.type) {
        if (formatter.type === 'func') {
          // 👈 call formatter with (value, row)
          return formatter?.func?.(value, this);
        } else if (formatter.type === 'pattern') {
          // Case 1: display pattern for multiple fields
          return this.evalPattern(formatter.pattern!);
        } else {
          // Case 2: single field with optional formatter
          if (value !== undefined && value !== null) {
            return this.format('form', value, formatter);
          }
        }
      }

      return value ?? '';
    } catch (error) {
      console.error(`[BaseModel.formFormatted] Error formatting field="${col.key}" for form`, {
        field: col,
        value: this.getValue(col.key),
        model: this.constructor.name,
        error
      });
      return this.getValue(col.key) ?? col.defaultValue ?? ''; // Return raw value or default on error
    }
  }

  /**
   * Override this in subclasses to define field descriptors
   * for data tables
   * Example:
   * static override get dataTableCols(): FieldDescriptor[] {
   *   return [
   *     { key: 'id', label: 'Id', opt: { link: true, formatter: { type: 'pattern', pattern: 'name (code)'} } },
   *     { key: 'accountingClass', label: 'Class' },
   *     { key: 'openingBalance', label: 'Opening Balance', opt: { formatter: { type: 'currency' } } },
   *     { key: 'openedAt', label: 'Opened At', opt: { formatter: { type: 'date', to: DateFormat.MED } } },
   *     { key: 'balance', label: 'Balance', opt: { formatter: { type: 'currency', locale: 'en-PK', currency: 'PKR' } } }
   *   ];
   * }
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
  dtFormatted(col: FieldDescriptor): any {
    try {
      let value = this.getValue(col.key);
      const formatter = col?.opt?.formatter;

      if (formatter?.type) {
        if (formatter.type === 'func') {
          // 👈 call formatter with (value, row)
          return formatter?.func?.(value, this);
        } else if (formatter.type === 'pattern') {
          // Case 1: display pattern for multiple fields
          return this.evalPattern(formatter.pattern!);
        } else {
          // Case 2: single field with optional formatter
          if (value !== undefined && value !== null) {
            return this.format('dt', value, formatter);
          }
        }
      }

      return value ?? '';
    } catch (error) {
      console.error(`[BaseModel.dtFormatted] Error formatting field="${col.key}" for datatable`, {
        field: col,
        value: this.getValue(col.key),
        model: this.constructor.name,
        error
      });
      return this.getValue(col.key) ?? ''; // Return raw value on error
    }
  }

  static readableName(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }


  static get searchForm(): SearchForm {
    return {};
  }

  /**
   * Example:
   * static override get searchForm() {
   *   return {
   *     name: { column: 'name', operator: '=', value: null },
   *     status: { column: 'status', operator: '=', value: null }
   *   };
   * }
   */
  static getSearchForm(): SearchForm {
    return this.searchForm;
  }
}