import { Component, ChangeDetectionStrategy, signal, effect, input, model, output, inject, forwardRef, AfterViewInit, OnDestroy, Injector, ChangeDetectorRef, Inject, Optional, SimpleChanges, computed, Renderer2, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormControl, NG_VALUE_ACCESSOR, ControlValueAccessor, NgControl, Validators, NG_VALIDATORS, Validator } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { Observable, Observer, Subscription, asapScheduler, map, observeOn, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'selectable-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TypeaheadModule, HttpClientModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectableControlComponent),
      multi: true
    }
  ],
  template: `
     <div class="selectable-control">
      <div class="lookup-input-wrapper form-control d-flex flex-wrap align-items-center" (click)="focusInput()">
        <ng-container *ngIf="multi() && value() && value()?.length">
          <span *ngFor="let item of selectedValues(); trackBy: trackByKey" class="badge bg-primary me-1 mb-1 d-flex align-items-center">
            {{ getOptionLabel(item) }}
            <button
              type="button"
              class="btn-close btn-close-white btn-sm ms-1"
              aria-label="Remove"
              (click)="removeItem(item)">
            </button>
          </span>
        </ng-container>

        <input
          #inputRef
          type="text"
          class="flex-grow-1 border-0"
          [placeholder]="multi() && value()?.length ? '' : placeholder()"
          [typeahead]="this.url() ? items$ : items()"
          [typeaheadOptionField]="optionField()"
          (typeaheadOnSelect)="onSelect($event.item)"
          [formControl]="searchControl"
          (blur)="handleBlur()"
          autocomplete="off"
        />
      </div>
    </div>
  `,
  styles: [
    `
    .selectable-control {
      width: 100%;
    }

    .lookup-input-wrapper {
      min-height: 38px;
      cursor: text;
    }

    .lookup-input-wrapper input {
      outline: none;
      min-width: 120px;
      background-color: inherit;
    }

    .lookup-input-wrapper:focus-within {
      border-color: #86b7fe;
      box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    }

    .badge {
      display: flex;
      align-items: center;
      font-size: 0.8rem;
    }

    .btn-close {
      font-size: 0.6rem;
    }
  `
  ]
})
export class SelectableControlComponent<T = any> implements OnDestroy, AfterViewInit, ControlValueAccessor {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  protected injector = inject(Injector);
  protected renderer = inject(Renderer2);
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
  value = model<T[keyof T][] | T[keyof T] | null>(null);
  valueChange = output<T[keyof T][] | T[keyof T] | null>();

  // --- Internal state ---
  items = signal<T[]>([]); // Available option (don't show selected one)

  // used with url
  items$: Observable<string>;
  
  // --- Computed state ---
  selectedValues = computed<T[]>(() => {
    // console.log('selectedValues called');
    const list = this.options() ?? [];
    const rawValue = this.value();

    if (!rawValue) return [];

    const ids = Array.isArray(rawValue) ? rawValue : [rawValue];
    return list.filter((item) => ids.includes(this.getOptionKey(item)));
  });


  readonly optionsEffect = effect(() => {
    const opts = this.options();
    if (opts?.length && this.pendingValue) {
      // console.log('optionsEffect triggered', this.pendingValue);
      this.setResolvedValue(this.pendingValue);
      this.pendingValue = null;
    }
  });

  watchSelection = effect(() => {
    const vals = this.selectedValues();
    // console.log('watchSelection Selection changed:', vals);
    // if(!this.multi()) this.searchControl.setValue(this.getOptionLabel(vals[0]));
  });

  searchControl = new FormControl('');

  private pendingValue: any = null;

  // --- CVA Callbacks (public for template usage) ---
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(@Optional() @Inject(NG_VALIDATORS) private validators: Validator[] = []) {
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
        this.items$ = new Observable((observer: Observer<string | undefined>) => {
          observer.next(this.searchControl.getRawValue());
        }).pipe(
          switchMap((query: string) => {
            if (!query) return of([]);
            // TODO: For Edit get/search and set using pendingValue
            return this.http.get<any>(urlValue, {
              params: { search: `name:${query}`, searchFields: `name:like` }
            }).pipe(
              map(res => res.data || []),
              tap({
                next: (items) => {
                  this.items.set(items?? []);
                  if (this.pendingValue) {
                    this.setResolvedValue(this.pendingValue);
                    this.pendingValue = null;
                  } else {
                    this.cdr.markForCheck();
                  }
                },
                error: () => {
                  this.items.set([]);
                  this.cdr.markForCheck();
                }
              })
            );
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
    // we propagate a null value to the parent form/control. 
    // This fixes the "select triggers change but emptying doesn't" problem.
    this.subs.add(
      this.searchControl.valueChanges.pipe(observeOn(asapScheduler)).subscribe((val: any) => {
        // consider empty or whitespace-only as "cleared"
        const isEmptyString = typeof val === 'string' && val.trim() === '';
        if (isEmptyString) {
          // only propagate if the current selected value isn't already null
          if (this.value() != null) {
            this.setValue(null);
          }
        }
      })
    );
  }

  // --- Selection logic ---
  onSelect(item: T) {
    const key = this.getOptionKey(item);
    const current = this.toArray(this.value()) as T[keyof T][];

    const exists = current.includes(key);
    const updated = this.multi() ? (exists ? current.filter((k) => k !== key) : [...current, key]) : [key];

    // If not multi, we just store the single value instead of array
    const valueToSet = this.multi() ? updated : updated[0];

    this.setValue(valueToSet);

    // optional: reflect selection in the searchControl UI — usually you'd clear it
    if(this.multi()) this.searchControl.patchValue('', { emitEvent: false });
  }

  removeItem(item: T): void {
    const key = this.getOptionKey(item);
    const filtered = this.toArray(this.value()).filter((id) => id !== key);
    this.setValue(this.multi() ? filtered : null);
  }

  // --- Core value propagation ---
  private setValue(value: any) {
    // short-circuit if unchanged (avoid duplicate propagation)
    try {
      const prev = this.value();
      if (JSON.stringify(prev) === JSON.stringify(value)) {
        return;
      }
    } catch {
      // fallthrough if JSON.stringify fails
    }

    this.value.set(value);
    this.valueChange.emit(value);

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

  private setResolvedValue(value: any): void {
    // value may be key(s) or full item(s). Normalize to same structure we use for propagation (keys).
    // We also update searchControl: single -> label, array -> empty (tags shown from selectedValues)
    if (value == null) {
      // Clear everything
      this.value.set(null);
      this.searchControl.setValue('');
      this.cdr.markForCheck();
      return;
    }

    if (this.multi()) {
      // expect array or single -> convert to array of keys
      const items = this.resolveItemsFromValue(value);
      const keys = items.map((i) => this.getOptionKey(i));
      this.value.set(keys);
      // show no text when multi (tags are shown)
      this.searchControl.patchValue('', { emitEvent: false });
    } else {
      // single select: want single key stored, and label shown in searchControl
      const items = this.resolveItemsFromValue(value);
      const first = items.length ? items[0] : null;
      const keyToStore = first ? this.getOptionKey(first) : (Array.isArray(value) ? (value[0] ?? null) : value);
      this.value.set(keyToStore);
      // set searchControl text to the label if we found the item; otherwise set empty
      if (first) {
        this.searchControl.setValue(this.getOptionLabel(first));
      } else {
        // if we don't have the option object yet, try to show raw value as string (optional)
        this.searchControl.setValue('');
      }
    }

    this.cdr.markForCheck();
  }

  // Resolve item objects from a provided value (value can be keys or full item objects)
  private resolveItemsFromValue(value: any): T[] {
    const allOptions = (this.options() ?? this.items() ?? []) as T[];
    const keys = Array.isArray(value) ? value : [value];

    // If value elements are objects that look like options already, return them
    const maybeObjects = keys.filter((k) => k && typeof k === 'object' && this.getOptionKey(k) != null);
    if (maybeObjects.length === keys.length) {
      return maybeObjects as T[];
    }

    // Otherwise, treat keys as key values and find matching option objects
    const found: T[] = [];
    for (const k of keys) {
      const match = allOptions.find((opt) => {
        try {
          return this.getOptionKey(opt) === k;
        } catch {
          return false;
        }
      });
      if (match) found.push(match);
    }
    return found;
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
  // Always store pending or resolved value
  if (!this.options()?.length) {
    this.pendingValue = value;
  } else {
    this.setResolvedValue(value);
  }

  // Also always clear when null/empty
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    this.value.set(null);
    this.searchControl.setValue('', { emitEvent: false });
  }

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

  private toArray(value: any): any[] {
    return Array.isArray(value) ? value : value != null ? [value] : [];
  }

  trackByKey = (index: number, item: any) => {
    return this.getOptionKey(item) ?? index;
  };

  focusInput() {
    this.inputRef?.nativeElement?.focus();
  }
  // --- life cycle functions ---

  ngAfterViewInit() {
    // console.log('DIAG: ngAfterViewInit running for SelectableControlComponent');
    // Get NgControl safely (after Angular finishes DI resolution)

    this.ngControl = this.injector.get(NgControl, null);
    // console.log('DIAG: ngControl =>', this.ngControl);
    // console.log('DIAG: ngControl.control =>', this.ngControl?.control);
    // console.log('DIAG: validators QueryList =>', this.validators);
    // console.log('DIAG: validators length =>', this.validators?.length);

    if (this.ngControl?.control && this.validators?.length) {
      // console.log('DIAG: entering validator block ✅');
      const composed = Validators.compose(this.validators.map((v) => v.validate.bind(v)));

      const existing = this.ngControl.control.validator;
      const composedValidator = existing
        ? Validators.compose([existing, composed])
        : composed;

      this.ngControl.control.setValidators(composedValidator);
      this.ngControl.control.updateValueAndValidity({ emitEvent: false });

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
