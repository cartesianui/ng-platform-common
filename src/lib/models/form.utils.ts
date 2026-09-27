import { FormControl, FormGroup } from '@angular/forms';
import { FieldDescriptor } from './types';
import { formatValue } from './formatter.utils';
import { DatetimeService } from '../services';

/**
 * Interface for classes that can provide values by key
 */
export interface IValueProvider {
  getValue(property: string): any;
  init(data?: Record<string, any>): this;
}

/**
 * Resolve a `defaultValue` declared on a `FieldDescriptor`. Most defaults are
 * static (literal numbers, strings, etc.) and pass through unchanged. Date
 * sentinels (`'today' | 'yesterday' | 'tomorrow'`) resolve to a fresh `Date`
 * at form-build time so date fields can default to "today" without each
 * create form patching it post-init. Same vocabulary the search-form /
 * listing-controls hydrator already uses — see
 * `ListingControlsComponent.resolveDateSentinel`.
 *
 * Usage:
 *   { key: 'orderedAt', label: 'Order Date', defaultValue: 'today',
 *     opt: { validators: [Validators.required], formatter: { type: 'date' } } }
 *
 * Module-load-time `new Date()` would freeze the timestamp at first import,
 * so the sentinel pattern lets the same descriptor produce the right "now"
 * on every form construction.
 */
function resolveDefaultValue(raw: any): any {
  // Sentinels coerce to JSDate (form controls / bsDatepicker want a Date);
  // anything else passes through. Sentinel vocabulary lives on
  // DatetimeService — see `resolveSentinel`.
  return DatetimeService.resolveSentinel(raw)?.toJSDate() ?? raw;
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
    let value = model.getValue(col.dataKey || col.key);
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
      value: model.getValue(col.dataKey || col.key),
      error
    });
    return model.getValue(col.dataKey || col.key) ?? '';
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
    let value = model.getValue(col.dataKey || col.key);

    // A freshly-constructed entity's field is `undefined` (TS class-field
    // declared but never assigned), not `null` — a boolean/toggle field
    // with `defaultValue` then fell through to `''` below instead of the
    // declared default, so the switch rendered "off" but the control's
    // real value was an empty string, which `Validators.required` rejects.
    // The form only became valid once the user manually touched the
    // toggle. Treat `undefined` the same as `null` here, consistent with
    // every other null-check in this file (formatForDb, the formatter
    // branch below).
    if ((value === null || value === undefined) && col.defaultValue !== undefined) {
      value = resolveDefaultValue(col.defaultValue);
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
      value: model.getValue(col.dataKey || col.key),
      error
    });
    return model.getValue(col.dataKey || col.key) ?? resolveDefaultValue(col.defaultValue) ?? '';
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
      const value = model.getValue(field.dataKey || field.key) ?? (resolveDefaultValue(field.defaultValue) ?? null);
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