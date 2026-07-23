import { Component, ContentChild, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { ValidateDirective } from '../directive/validate.directive';
import { ValidationService } from '../validation.service';
import { HttpErrorService, IError } from '@cartesianui/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { ROW_INDEX_KEY } from '../validation.types';

@Component({
    selector: 'with-validation',
    template: `
      <div class="component-wrapper">
        <ng-content></ng-content>
        <div class="invalid-feedback" [innerHTML]="errorMessage"></div>
      </div>
    `,
    styles: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WithValidationComponent implements OnInit, AfterContentInit {
  // `static: false` — directive is resolved after `ngAfterContentInit`
  // rather than at creation. Required when `<with-validation>` wraps a
  // control behind a sibling structural directive (e.g. schema-form's
  // per-type `*ngIf` branches). Legacy callers with a direct-child
  // control still work identically; only the resolution timing shifts
  // by one lifecycle hook.
  @ContentChild(ValidateDirective) validateDirective!: ValidateDirective;

  constructor(
    private validationOberverService: ValidationService,
    private errorService: HttpErrorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // ContentChild with `static: false` resolves in ngAfterContentInit, not
    // here — moved the directive-dependent setup down accordingly.
  }

  ngAfterContentInit(): void {
    if (!this.validateDirective) {
      console.warn('[with-validation] No validate directive found. Ensure the child control has the "validate" attribute.');
      return;
    }

    const control = this.validateDirective.ngControl?.control;
    if (control) {
      control.statusChanges.subscribe(() => this.cdr.markForCheck());

      // A server-rejected field must clear on the next edit, not linger
      // forever — setErrors() only ever adds `serverError` (see below), and
      // Angular never auto-clears manually-injected custom errors on its
      // own, so without this a fixed field keeps the whole form permanently
      // invalid/unsavable.
      control.valueChanges.subscribe(() => {
        if (control.errors?.['serverError']) {
          const { serverError, ...rest } = control.errors;
          control.setErrors(Object.keys(rest).length ? rest : null);
        }
      });
    }

    this.errorService.serverErrors$.subscribe((errors) => this.setServerError(errors, this.validateDirective));
  }

  get errorMessage(): string | null {
    const errors = Object.entries(this.validateDirective?.ngControl?.control?.errors || {});

    // if(this.validateDirective?.ngControl?.name == "classId") {
    //   console.log(this.validateDirective?.ngControl);
    //   console.log(errors);
    // }

    if (!this.validateDirective?.ngControl?.dirty && !this.validateDirective?.ngControl?.touched) return '';
    if (!errors.length) {
      return null;
    }

    const passedControlName = this.validateDirective?.controlName;
    const formControlName = passedControlName ?? (this.validateDirective?.ngControl?.name as string) ?? 'This Field';
    return this.validationOberverService.getErrorValidationMessage(this.humanReadable(formControlName), errors);
  }

  setServerError(errors: IError, validateDirective) {
    const control = validateDirective?.ngControl?.control;
    const name = validateDirective?.ngControl?.name as string | undefined;
    if (!control || !name) {
      return;
    }
    const rowIndex = this.findRowIndex(control);
    const fieldErrors = this.resolveFieldErrors(errors, name, rowIndex);

    if (fieldErrors) {
      control.setErrors({
        ...control.errors,
        serverError: this.formatErrorsAsHtml(fieldErrors)
      } as ValidationErrors);

      // 👇 Mark control as touched so error displays immediately
      control.markAsTouched();

      // Optionally: control.markAsDirty(); if your app uses that check
      control.markAsDirty();

      // 👉 Tell Angular to re-check the component
      this.cdr.markForCheck();

    }
  }

  /**
   * Resolve which entry in the dispatched server-errors map applies to a
   * given control name. Two lookup shapes are supported:
   *
   *   1. Direct match: errors[name] — flat key (e.g. `{ vendorId: [...] }`).
   *      This is the legacy shape used by every Apiato controller that
   *      throws against a top-level model property.
   *
   *   2. Dotted suffix: errors["section.<name>"] — used by the schema-driven
   *      Configuration validator (`{ "accounting.default_cash_account_id": [...] }`),
   *      and by any other form whose payload nests fields under a section.
   *      The directive can't know its parent section here, so it accepts
   *      ANY dotted key whose last segment matches its control name.
   *
   * Returns the matching messages array (or string) or undefined when
   * neither shape hits.
   */
  private resolveFieldErrors(errors: IError, name: string, rowIndex?: number): string | string[] | undefined {
    if (!errors) return undefined;

    if (rowIndex !== undefined) {
      // This control lives inside a repeatable row (e.g. a line item) —
      // only accept an error keyed for THIS row's position, such as
      // `items.0.reasonCode` / `lines.0.amount`. A bare `name` match or
      // another row's index must NOT apply here, otherwise one line's
      // error lights up every line that has a same-named field.
      const rowSuffix = `.${rowIndex}.${name}`;
      for (const key of Object.keys(errors)) {
        if (key.endsWith(rowSuffix)) {
          return errors[key] as string | string[];
        }
      }
      return undefined;
    }

    // Direct match wins — preserves backward-compat for flat-shape APIs.
    if (errors[name] !== undefined) {
      return errors[name] as string | string[];
    }

    // Dotted-suffix match — find any key like `*.<name>` or `*.<part>.<name>`.
    const suffix = '.' + name;
    for (const key of Object.keys(errors)) {
      if (key.endsWith(suffix)) {
        return errors[key] as string | string[];
      }
    }

    return undefined;
  }

  /** Walks the control's FormGroup ancestry for the nearest repeatable-row index stamp (see `ROW_INDEX_KEY`). */
  private findRowIndex(control: AbstractControl | null | undefined): number | undefined {
    let node: AbstractControl | null | undefined = control;
    while (node) {
      const idx = (node as any)[ROW_INDEX_KEY];
      if (idx !== undefined) return idx;
      node = node.parent;
    }
    return undefined;
  }

  private humanReadable(name: string): string {
    // Remove 'Id' suffix (e.g., 'vendorId' -> 'vendor')
    const cleanName = name.replace(/Id$/, '');

    return cleanName
      .replace(/(?<=[a-zA-Z])(?=[A-Z])/g, ' ')
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  private formatErrorsAsHtml(errors: string | string[]): string {
    const errorArray = Array.isArray(errors)
      ? errors
      : errors
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

    return errorArray
      .map((err) => err.replace(/[.,]$/, '').trim())
      .filter(Boolean)
      .map((err) => `${err}.`)
      .join('<br>');
  }
}
