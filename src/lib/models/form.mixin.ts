import { FormGroup } from '@angular/forms';
import { FieldDescriptor } from './types';
import { formatForDb, formatForForm, toFormGroup, fromFormGroup, normalizeFormFields } from './form.utils';
import { FieldMetaBuilder } from './utils';

type Constructor<T = {}> = new (...args: any[]) => T;

interface IFormatterModel {
  getValue(property: string): any;
  init(data?: Record<string, any>): any;
  evalPattern(pattern: string): string;
}

export function FormMixin<TBase extends Constructor<IFormatterModel>>(Base: TBase) {
  return class FormBase extends Base {

    static formFields?: FieldDescriptor[] = [];

    toForm(patch?: Partial<any>): FormGroup {
      if (patch) {
        this.init(patch);
      }
      const ctor = this.constructor as any;
      const decoratorFields = FieldMetaBuilder.buildForm(ctor);
      const rawFormFields = decoratorFields.length > 0 ? decoratorFields : (ctor.formFields ?? []);
      const formFields = normalizeFormFields(rawFormFields);
      return toFormGroup(this, formFields, (col) => this.formFormatted(col));
    }

    fromForm(formGroup?: FormGroup): this {
      if (!formGroup) return this;
      const ctor = this.constructor as any;
      const decoratorFields = FieldMetaBuilder.buildForm(ctor);
      const rawFormFields = decoratorFields.length > 0 ? decoratorFields : (ctor.formFields ?? []);
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
  };
}
