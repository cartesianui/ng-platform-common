import { FormGroup } from '@angular/forms';
import { SearchForm } from '@cartesianui/core';
import { FieldDescriptor, FormatterOptions } from './types';
import { formatValue, formatDate, formatMultiline, wrapWithDisplayStyle, evalPattern } from './formatter.utils';
import { formatForDb, formatForForm, toFormGroup, fromFormGroup, normalizeFormFields } from './form.utils';
import { formatForDataTable, getHeaders, toReadableName } from './datatable.utils';


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

  // ============================================
  // Core Model Methods
  // ============================================

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

  // ============================================
  // Formatting Methods (delegate to formatter.ts)
  // ============================================

  format(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
    return formatValue(target, value, formatter, this);
  }

  evalDate(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
    return formatDate(target, value, formatter);
  }

  evalMultiline(formatter?: FormatterOptions): string {
    return formatMultiline(formatter, this);
  }

  wrapWithDisplayStyle(value: any, formatter: FormatterOptions): string {
    return wrapWithDisplayStyle(value, formatter);
  }

  evalPattern(pattern: string): string {
    const cls = this.constructor as typeof BaseModel;
    return evalPattern(pattern, this, (key) => cls.getDataTableCol(key)?.opt?.formatter);
  }

  // ============================================
  // Form Methods (delegate to form.mixin)
  // ============================================

  static formFields?: FieldDescriptor[] = [];

  toForm(patch?: Partial<this>): FormGroup {
    if (patch) {
      this.init(patch);
    }
    const rawFormFields = (this.constructor as any).formFields ?? [];
    const formFields = normalizeFormFields(rawFormFields);
    return toFormGroup(this, formFields, (col) => this.formFormatted(col));
  }

  fromForm(formGroup?: FormGroup): this {
    if (!formGroup) return this;
    const rawFormFields = (this.constructor as any).formFields ?? [];
    const formFields = normalizeFormFields(rawFormFields);
    fromFormGroup(this, formGroup, formFields, (col) => this.dbFormatted(col));
    return this;
  }

  dbFormatted(col: FieldDescriptor): any {
    return formatForDb(this, col, (p) => this.evalPattern(p));
  }

  formFormatted(col: FieldDescriptor): any {
    return formatForForm(this, col, (p) => this.evalPattern(p));
  }

  // ============================================
  // DataTable Methods (delegate to datatable.mixin)
  // ============================================

  static get dataTableCols(): FieldDescriptor[] {
    return [];
  }

  static getDataTableCols(): FieldDescriptor[] {
    return this.dataTableCols;
  }

  static getDataTableCol(key: string): FieldDescriptor | undefined {
    return (this as any).listViewFields?.find((field: FieldDescriptor) => field.key === key);
  }

  static getDataTableHeaders(): { name: string; prop?: string }[] {
    return getHeaders(this.dataTableCols, toReadableName);
  }

  dtFormatted(col: FieldDescriptor): any {
    return formatForDataTable(this, col, (p) => this.evalPattern(p));
  }

  // ============================================
  // Search Methods
  // ============================================

  static get searchForm(): SearchForm {
    return {};
  }

  static getSearchForm(): SearchForm {
    return this.searchForm;
  }

  // ============================================
  // Utilities
  // ============================================

  static readableName(key: string): string {
    return toReadableName(key);
  }
}