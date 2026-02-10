import { FormControl, FormGroup } from '@angular/forms';
import { FieldDescriptor } from './types';
import { formatValue } from './formatter.utils';

/**
 * Interface for classes that can provide values by key
 */
export interface IValueProvider {
  getValue(property: string): any;
  init(data?: Record<string, any>): this;
}

/**
 * Format value for database output
 */
export function formatForDb(
  model: IValueProvider,
  col: FieldDescriptor,
  evalPattern: (pattern: string) => string
): any {
  try {
    let value = model.getValue(col.key);
    const formatter = col?.opt?.formatter;

    if (formatter?.type) {
      if (formatter.type === 'func') {
        return formatter?.func?.(value, model);
      } else if (formatter.type === 'pattern') {
        return evalPattern(formatter.pattern!);
      } else {
        if (value !== undefined && value !== null) {
          return formatValue('db', value, formatter, model);
        }
      }
    }

    return value ?? '';
  } catch (error) {
    console.error(`[form.formatForDb] Error formatting field="${col.key}"`, {
      field: col,
      value: model.getValue(col.key),
      error
    });
    return model.getValue(col.key) ?? '';
  }
}

/**
 * Format value for form display
 */
export function formatForForm(
  model: IValueProvider,
  col: FieldDescriptor,
  evalPattern: (pattern: string) => string
): any {
  try {
    let value = model.getValue(col.key);

    if (value === null && col.defaultValue !== undefined) {
      value = col.defaultValue;
    }

    const formatter = col?.opt?.formatter;

    if (formatter?.type) {
      if (formatter.type === 'func') {
        return formatter?.func?.(value, model);
      } else if (formatter.type === 'pattern') {
        return evalPattern(formatter.pattern!);
      } else {
        if (value !== undefined && value !== null) {
          return formatValue('form', value, formatter, model);
        }
      }
    }

    return value ?? '';
  } catch (error) {
    console.error(`[form.formatForForm] Error formatting field="${col.key}"`, {
      field: col,
      value: model.getValue(col.key),
      error
    });
    return model.getValue(col.key) ?? col.defaultValue ?? '';
  }
}

/**
 * Create FormGroup from model instance
 */
export function toFormGroup(
  model: IValueProvider,
  formFields: FieldDescriptor[],
  formatForFormFn: (col: FieldDescriptor) => any
): FormGroup {
  try {
    const formControls: { [key: string]: FormControl } = {};

    const entries = formFields.map((field: any) => {
      const value = (model as any)[field.key] ?? (field.defaultValue ?? null);
      return {
        key: field.key,
        label: field.label ?? field.key,
        defaultValue: value,
        opt: field.opt ?? {}
      };
    });

    for (const entry of entries) {
      try {
        formControls[entry.key] = new FormControl(
          formatForFormFn(entry) ?? null,
          entry?.opt?.validators ?? []
        );
      } catch (error) {
        console.error(`[form.toFormGroup] Error creating control for field="${entry.key}"`, {
          field: entry,
          error
        });
        formControls[entry.key] = new FormControl(entry.defaultValue ?? null, entry?.opt?.validators ?? []);
      }
    }

    return new FormGroup(formControls);
  } catch (error) {
    console.error(`[form.toFormGroup] Error creating form group`, { error });
    return new FormGroup({});
  }
}

/**
 * Populate model from FormGroup
 */
export function fromFormGroup(
  model: IValueProvider,
  formGroup: FormGroup,
  formFields: FieldDescriptor[],
  formatForDbFn: (col: FieldDescriptor) => any
): void {
  if (!formGroup) return;

  try {
    const json = formGroup.value;
    if (!json) return;

    model.init(json);

    const formFieldsMap: Record<string, FieldDescriptor> = Object.fromEntries(
      formFields.map((field) => [field.key, field])
    );

    for (const property in json) {
      if (!Object.prototype.hasOwnProperty.call(json, property)) continue;

      try {
        let value = json[property];
        const descriptor = formFieldsMap[property];

        if (descriptor?.opt?.formatter) {
          value = formatForDbFn(descriptor);
        }

        (model as any)[property] = value;
      } catch (error) {
        console.error(`[form.fromFormGroup] Error processing field="${property}"`, {
          property,
          value: json[property],
          error
        });
        (model as any)[property] = json[property];
      }
    }
  } catch (error) {
    console.error(`[form.fromFormGroup] Error converting form to model`, { error });
  }
}

/**
 * Normalize formFields (string[] or FieldDescriptor[]) to FieldDescriptor[]
 */
export function normalizeFormFields(rawFormFields: (string | FieldDescriptor)[]): FieldDescriptor[] {
  return rawFormFields.map((field: any) => {
    if (typeof field === 'string') {
      return { key: field, label: field };
    }
    return field;
  });
}