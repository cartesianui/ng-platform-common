import {
  Component,
  ChangeDetectionStrategy,
  signal,
  effect,
  input,
  model,
  output,
  inject,
  forwardRef,
  AfterViewInit,
  OnDestroy,
  Injector,
  ChangeDetectorRef,
  ContentChildren,
  QueryList,
  Inject
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  AbstractControl,
  ValidationErrors,
  NgControl,
  Validators,
  NG_VALIDATORS,
  Validator
} from '@angular/forms';
import { isObservable, firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { Subscription } from 'rxjs';
import { observeOn } from 'rxjs/operators';
import { asapScheduler } from 'rxjs';

import { Directive, Optional, Self, Host, SkipSelf } from '@angular/core';

@Component({
  selector: 'typeahead-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TypeaheadModule, HttpClientModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TypeaheadSelectComponent),
      multi: true,
    },
    // {
    //   provide: NG_VALIDATORS,
    //   useExisting: forwardRef(() => TypeaheadSelectComponent),
    //   multi: true,
    // },
  ],
  template: `
    <div class="typeahead-select">
      <input
        type="text"
        class="form-control"
        [placeholder]="placeholder()"
        [typeahead]="items()"
        [typeaheadOptionField]="optionField()"
        (typeaheadOnSelect)="onSelect($event.item)"
        [formControl]="searchControl"
        (blur)="handleBlur()"
        autocomplete="off"
      />

      <!-- selected items (for multi-select) -->
      <div *ngIf="multi() && selected() && selected()?.length" class="selected-items mt-2">
        <span *ngFor="let item of selectedObjects(); trackBy: trackByKey" class="badge bg-primary me-1">
          {{ getOptionLabel(item) }}
          <button
            type="button"
            class="btn-close btn-close-white btn-sm ms-1"
            aria-label="Remove"
            (click)="removeItem(item)"
          ></button>
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      .typeahead-select {
        width: 100%;
      }
      .selected-items {
        display: flex;
        flex-wrap: wrap;
      }
      .badge {
        display: flex;
        align-items: center;
      }
      .btn-close {
        font-size: 0.6rem;
      }
    `
  ]
})
export class TypeaheadSelectComponent<T = any> implements OnDestroy, AfterViewInit, ControlValueAccessor  {

  //@ContentChildren(NG_VALIDATORS, { descendants: true }) validators!: QueryList<Validator>;
  //@Optional() @Host() @Self() validators: Validator[] = [];

  protected injector = inject(Injector);
  protected cdr = inject(ChangeDetectorRef);
  protected ngControl: NgControl | null = null;
  protected http = inject(HttpClient);
  protected subs = new Subscription();

  // --- Inputs ---
  url = input<string | null>(null);
  options = input<T[] | null>(null);
  ignoreOptions = input<T[]>([]);
  multi = input(false);
  optionKey = input<string>('id');
  optionField = input('name');
  placeholder = input('Search...');

  // --- Two-way bound model ---
  selected = model<T[keyof T][] | T[keyof T] | null>(null);
  selectedChange = output<T[keyof T][] | T[keyof T] | null>();

  // --- Internal state ---
  items = signal<T[]>([]);              // Available option (don't show selected one)
  searchControl = new FormControl('');

  // --- CVA Callbacks (public for template usage) ---
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(
    @Optional() @Inject(NG_VALIDATORS) private validators: Validator[] = []
  ) {
    // lazy-load ngControl to avoid circular dep
    queueMicrotask(() => {
      try {
        // Injector.get with fallback null
        this.ngControl = this.injector.get(NgControl, null);
        if (this.ngControl) {
          this.ngControl.valueAccessor = this;
        }
      } catch {
        // no form control found
        this.ngControl = null;
      }
    });

    // Load items from URL or data (reactive)
    effect(() => {
      const urlValue = this.url();
      const dataValue = this.options();

      if (urlValue) {
        this.subs.add(
          this.http
            .get<T[]>(urlValue)
            .pipe(observeOn(asapScheduler))
            .subscribe({
              next: (res) => {
                this.items.set(res ?? []);
                this.cdr.markForCheck();
              },
              error: () => {
                this.items.set([]);
                this.cdr.markForCheck();
              }
            })
        );
      } else if (dataValue) {
        this.items.set(dataValue ?? []);
        this.cdr.markForCheck();
      } else {
        this.items.set([]);
      }
    });

    // IMPORTANT: watch the search input so that when user clears it (backspace to empty),
    // we propagate a null value to the parent form/control. This fixes the "select triggers change
    // but emptying doesn't" problem.
    this.subs.add(
      this.searchControl.valueChanges
        .pipe(observeOn(asapScheduler))
        .subscribe((val: any) => {
          // consider empty or whitespace-only as "cleared"
          const isEmptyString = typeof val === 'string' && val.trim() === '';
          if (isEmptyString) {
            // only propagate if the current selected value isn't already null
            if (this.selected() != null) {
              this.setValue(null);
            }
          }
        })
    );
  }

  // --- Selection logic ---
  onSelect(item: T) {
    const key = this.getOptionKey(item);
    const current = this.toArray(this.selected()) as (T[keyof T])[];

    const exists = current.includes(key);
    const updated = this.multi()
      ? exists
        ? current.filter(k => k !== key)
        : [...current, key]
      : [key];

    // If not multi, we just store the single value instead of array
    const valueToSet = this.multi() ? updated : updated[0];

    this.setValue(valueToSet);

    // optional: reflect selection in the searchControl UI — usually you'd clear it
    // this.searchControl.setValue('');
  }

  removeItem(item: T): void {
    const key = this.getOptionKey(item);
    const filtered = this.toArray(this.selected()).filter(id => id !== key);
    this.setValue(this.multi() ? filtered : null);
  }

  // --- Core value propagation ---
  private setValue(value: any) {
    // short-circuit if unchanged (avoid duplicate propagation)
    try {
      const prev = this.selected();
      if (JSON.stringify(prev) === JSON.stringify(value)) {
        return;
      }
    } catch {
      // fallthrough if JSON.stringify fails
    }

    this.selected.set(value);
    this.selectedChange.emit(value);

    // notify Angular forms via CVA callback (this is the canonical way)
    this.onChange(value);

    // mark touched (we consider a change to be an interaction)
    // NOTE: some flows might not want to call onTouched() here; adjust if needed.
    this.onTouched();

    // Only mark parent states and update validity — without calling setValue on parent control
    // (calling parent.setValue would conflict with ControlValueAccessor expectations)
    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsDirty();
        // re-run validations
        ctrl.updateValueAndValidity({ emitEvent: true });
      }
    } catch {
      // swallow potential control errors
    }

    // ensure UI updates under OnPush
    this.cdr.markForCheck();
  }

  handleBlur() {
    // propagate touched state to Angular forms
    this.onTouched();
    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsTouched();
        // update validity so with-validation picks up the error immediately
        ctrl.updateValueAndValidity({ emitEvent: true });
      }
    } catch {
      // ignore
    }
    this.cdr.markForCheck();
  }

  // --- CVA Interface ---
  writeValue(value: any): void {
    // When parent writes value to us
    this.selected.set(value);
    // optional: update searchControl text to show label for single-select
    // TODO: if you want to reflect the selected label in the search box, set searchControl here
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.searchControl.disable() : this.searchControl.enable();
    this.cdr.markForCheck();
  }

  // --- Validator ---

  // validate(control: AbstractControl): ValidationErrors | null {
  //   const selected = this.selected();
  //   const isEmpty = selected == null || (Array.isArray(selected) && selected.length === 0);

  //   // get validator info safely without invoking the validator function
  //   const hasRequired = control.hasValidator?.(Validators.required);
  //   const minLength = control.hasValidator?.(Validators.minLength(10));

  //   const errors: ValidationErrors = {};

  //   if (hasRequired && isEmpty) errors['required'] = true;
  //   if (minLength && !isEmpty && String(selected).length < 10) errors['minlength'] = { requiredLength: 10, actualLength: String(selected).length };

  //   return Object.keys(errors).length ? errors : null;
  // }

  // validate(control: AbstractControl): ValidationErrors | null {
  //   console.log('here 1');
  //   const parentControl = this.ngControl?.control ?? control;
  //   if (!parentControl) return null;
  //   console.log('here 2');

  //   // Use the passed control’s validator, not parentControl's — avoid recursion
  //   const syncErrors = control.validator ? control.validator(control) : null;
  //   const asyncErrors = control.asyncValidator ? control.asyncValidator(control) : null;

  //   const selected = this.selected();
  //   const isEmpty = selected == null || (Array.isArray(selected) && selected.length === 0);

  //   let errors: ValidationErrors | null = syncErrors ? { ...syncErrors } : null;

  //   if (isEmpty && (errors?.['required'] || parentControl.hasValidator?.(Validators.required))) {
  //     errors = { ...(errors ?? {}), required: true };
  //   }

  //   if (asyncErrors instanceof Promise) {
  //     return asyncErrors.then(e => ({ ...(errors ?? {}), ...(e ?? {}) }));
  //   }
  //   if (asyncErrors) {
  //     return { ...(errors ?? {}), ...(asyncErrors ?? {}) };
  //   }

  //   return errors;
  // }



  // validate(control: AbstractControl): ValidationErrors | null {
  //   const parentControl = this.ngControl?.control ?? control;
  //   if (!parentControl) return null;

  //   const selected = this.selected();
  //   const isEmpty = selected == null || (Array.isArray(selected) && selected.length === 0);

  //   const validatorFn = parentControl.validator;
  //   const asyncValidatorFn = parentControl.asyncValidator;

  //   let errors: ValidationErrors | null = null;

  //   // Run sync validators
  //   if (validatorFn) {
  //     const result = validatorFn(parentControl);
  //     if (result) errors = { ...errors, ...result };
  //   }

  //   console.log(errors);

  //   // Run async validators safely (Observable or Promise)
  //   if (asyncValidatorFn) {
  //     const result = asyncValidatorFn(parentControl);
  //     if (isObservable(result)) {
  //       // Convert Observable to Promise to resolve once
  //       firstValueFrom(result).then(res => {
  //         if (res) {
  //           parentControl.setErrors({
  //             ...parentControl.errors,
  //             ...res
  //           });
  //         }
  //       });
  //     } else if (result instanceof Promise) {
  //       result.then(res => {
  //         if (res) {
  //           parentControl.setErrors({
  //             ...parentControl.errors,
  //             ...res
  //           });
  //         }
  //       });
  //     }
  //   }

  //   // Built-in fallback for "required"
  //   const hasRequired =
  //     !!errors?.['required'] || parentControl.hasValidator?.(Validators.required);

  //   if (hasRequired && isEmpty) {
  //     errors = { ...errors, required: true };
  //   }

  //   // Handle custom noWhiteSpace validator (if needed)
  //   if (typeof selected === 'string' && !selected.trim()) {
  //     errors = { ...errors, noWhiteSpace: true };
  //   }

  //   // Apply to parent control
  //   if (errors && Object.keys(errors).length) {
  //     parentControl.setErrors(errors);
  //     return errors;
  //   } else {
  //     parentControl.setErrors(null);
  //     return null;
  //   }
  // }

  // registerOnValidatorChange?(fn: () => void): void {
  //   // Optional: store fn and call when internal state changes if needed
  // }

  // ---- Helpers ---
  getOptionKey(item: T): any {
    return item?.[this.optionKey()];
  }

  getOptionLabel(item: T): string {
    const field = this.optionField();
    return (item && (item as any)[field]) ?? String(item);
  }

  equals(a: T, b: T): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return a === b;
    }
  }

  selectedObjects(): T[] {
    const ids = this.toArray(this.selected());
    return this.items().filter(i => ids.includes(this.getOptionKey(i)));
  }

  private toArray(value: any): any[] {
    return Array.isArray(value) ? value : value != null ? [value] : [];
  }

  trackByKey = (index: number, item: any) => {
    return this.getOptionKey(item) ?? index;
  };

  // --- life cycle functions ---

  ngAfterViewInit() {
    // console.log('DIAG: ngAfterViewInit running for TypeaheadSelectComponent');
    // Get NgControl safely (after Angular finishes DI resolution)

    this.ngControl = this.injector.get(NgControl, null);
    // console.log('DIAG: ngControl =>', this.ngControl);
    // console.log('DIAG: ngControl.control =>', this.ngControl?.control);
    // console.log('DIAG: validators QueryList =>', this.validators);
    // console.log('DIAG: validators length =>', this.validators?.length);

    if (this.ngControl?.control && this.validators?.length) {

      // console.log('DIAG: entering validator block ✅');
      const composed = Validators.compose(this.validators.map(v => v.validate.bind(v)));

      const existing = this.ngControl.control.validator;
      this.ngControl.control.setValidators([existing, composed]);
      this.ngControl.control.updateValueAndValidity({ emitEvent: false });

      // DIAGNOSTICS — run each collected validator manually and log its result
      const ctrl = this.ngControl!.control!;
      // console.log('DIAG: control.value =>', ctrl.value);
      // console.log('DIAG: control.validator(ctrl) =>', ctrl.validator ? ctrl.validator(ctrl) : null);
      this.validators.forEach((v, i) => console.log(`DIAG: validator[${i}] ->`, v.constructor.name, '->', v.validate(ctrl)));
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
