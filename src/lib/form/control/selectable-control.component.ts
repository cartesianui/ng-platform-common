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
  Inject,
  Optional,
  computed,
  Renderer2,
  ViewChild,
  ElementRef
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NgControl,
  Validators,
  NG_VALIDATORS,
  Validator
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import {
  Observable,
  Observer,
  Subscription,
  asapScheduler,
  map,
  observeOn,
  of,
  switchMap,
  tap
} from 'rxjs';
import { AppConfig, ObjectUtils } from '@cartesianui/core';
import { isUuid, isValidInteger } from '../../helpers';;

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
        <ng-container *ngIf="multi() && computedValues() && computedValues()?.length">
          <span *ngFor="let item of computedValues(); trackBy: trackByKey" class="badge bg-primary me-1 mb-1 d-flex align-items-center">
            {{ getOptionLabel(item) }}
            <button
              type="button"
              class="btn-close btn-close-white btn-sm ms-1"
              aria-label="Remove"
              (click)="removeItem(item)"
            ></button>
          </span>
        </ng-container>

        <input
          #inputRef
          type="text"
          class="flex-grow-1 border-0"
          [placeholder]="multi() && computedValues()?.length ? '' : placeholder()"
          [typeahead]="this.url() || this.optionsUrl() ? items$ : items()"
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
  url = input<string | null>(null); // backward compatibility
  options = input<T[] | null>(null);
  optionsUrl = input<string | null>(null); // to get options
  getByIdUrl = input<string | null>(null); // in case get by id url is different then options url
  ignoreOptions = input<T[]>([]);
  multi = input(false);
  optionKey = input<string>('id');
  optionField = input('name');
  placeholder = input('Search...');

  // --- Two-way bound model (keys) ---
  value = model<T[keyof T][] | T[keyof T] | null>(null);
  valueChange = output<T[keyof T][] | T[keyof T] | null>();

  // --- Two-way bound model (full object(s)) ---
  entity = model<T[] | T | null>(null);
  entityChange = output<T[] | T | null>();

  // --- Internal state ---
  items = signal<T[]>([]); // Available option (don't show selected one)

  // used with url
  items$: Observable<any>;

  searchControl = new FormControl('');

  // store a pending value when options are not yet available (same as before)
  private pendingRawValue: any = null;

  // Track last URL to know if we need to fetch by id
  // private lastUrlValue: string | null = null;

  // --- Computed state: computedValues used by template for rendering badges etc.
  // Priority: use `entity()` if available, otherwise resolve from `value()`.
  computedValues = computed<T[]>(() => {
    const sel = this.entity();
    if (sel == null) return [];
    if (Array.isArray(sel)) return sel;
    return [sel];
  });

  // Keep previous behavior: also respond to options being set and resolve pending values
  // Track last options reference to avoid reacting to identical arrays (common when
  // parent passes a freshly-created but equal array on each change detection).
  private lastOptionsRef: T[] | null = null;

  readonly optionsEffect = effect(() => {
    const opts = this.options();
    // If options reference hasn't changed, do nothing.
    if (opts === this.lastOptionsRef) return;
    this.lastOptionsRef = opts ?? null;

    if (opts?.length && this.pendingRawValue != null) {
      // Resolve any pending raw value (from writeValue) once options are available
      this.setResolvedValue(this.pendingRawValue);
      this.pendingRawValue = null;
    }
  });

  // watchSelection left in place for possible future use; uses computedValues to react
  watchSelection = effect(() => {
    const vals = this.computedValues();
    // intentionally left minimal - UI updates come via computed and change detection
    // console.log('watchSelection Selection changed:', vals);
    // if(!this.multi()) this.searchControl.setValue(this.getOptionLabel(vals[0]));
  });

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
      const urlValue = this.optionsUrl() ?? this.url();
      const dataValue = this.options();

      if (urlValue) {
        // Track URL change to trigger id-based fetch if needed
        // this.lastUrlValue = urlValue;

        // If we have a pending value (initial value set), try to fetch it by id first
        if (this.pendingRawValue != null && (isUuid(this.pendingRawValue) || isValidInteger(this.pendingRawValue))) {
          this.fetchItemById(this.pendingRawValue);
        }

        this.items$ = new Observable((observer: Observer<string | undefined>) => {
          observer.next(this.searchControl.getRawValue());
        }).pipe(
          switchMap((query: string) => {
            if (!query) return of([]);
            // TODO: For Edit get/search and set using pendingValue
            return this.http
              .get<any>(urlValue, {
                params: { search: `name:${query}`, searchFields: `name:like` }
              })
              .pipe(
                map((res) => {
                  // check response keys conversion settings
                  if (AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP) {
                    return ObjectUtils.convertObjectKeys(res.data, AppConfig.keysFormatAPI, AppConfig.keysFormatAPP);
                  }
                  return res.data || []
                }),
                tap({
                  next: (items) => {
                    this.items.set(items ?? []);
                    if (this.pendingRawValue != null) {
                      // Resolve pending once we have items/options
                      this.setResolvedValue(this.pendingRawValue);
                      this.pendingRawValue = null;
                    } else {
                      // Ensure selected is in sync with value (if value present)
                      if (this.value() != null) {
                        // attempt to refresh selected from available items/options
                        // setResolvedValue will derive selected from value
                        this.setResolvedValue(this.value());
                      }
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
        // If we already have value stored, ensure `selected` is resolved from those options
        if (this.value() != null) {
          this.setResolvedValue(this.value());
        }
        this.cdr.markForCheck();
      } else {
        this.items.set([]);
      }
    });

    // Watch the search input so that when user clears it we propagate a null value to the parent
    this.subs.add(
      this.searchControl.valueChanges.pipe(observeOn(asapScheduler)).subscribe((val: any) => {
        const isEmptyString = typeof val === 'string' && val.trim() === '';
        if (isEmptyString) {
          if (this.value() != null || this.entity() != null) {
            this.setValue(null);
          }
        }
      })
    );
  }

  // Fetch a single item by id from the URL endpoint (used for edit forms with initial id value)
  private fetchItemById(id: any): void {
    const url = this.getByIdUrl() ?? this.optionsUrl() ?? this.url();

    this.subs.add(
      this.http
        .get<any>(`${url}/${id}`)
        .subscribe({
          next: (res) => {
            // Handle wrapped response (e.g., { data: {...} })
            let item = res?.data || res;
            if (AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP) {
              item = ObjectUtils.convertObjectKeys(res.data, AppConfig.keysFormatAPI, AppConfig.keysFormatAPP);
            }
            
            if (item) {
              this.items.set([item]);
              this.setResolvedValue(id);
              this.pendingRawValue = null;
            }
            this.cdr.markForCheck();
          },
          error: () => {
            // If fetch by id fails, let it stay pending for later resolution
            this.cdr.markForCheck();
          }
        })
    );
  }

  // --- Selection logic ---
  onSelect(item: T) {
    const key = this.getOptionKey(item);
    // current keys array
    const currentKeys = this.toArray(this.value()) as any[];

    const exists = currentKeys.includes(key);
    const updatedKeys = this.multi() ? (exists ? currentKeys.filter((k) => k !== key) : [...currentKeys, key]) : [key];

    const valueToSet = this.multi() ? updatedKeys : updatedKeys[0];

    // setValue will also set `selected` appropriately (resolve item objects)
    this.setValue(valueToSet);

    // For UX: clear input for multi (tags are visible)
    if (this.multi()) this.searchControl.patchValue('', { emitEvent: false });
  }

  removeItem(item: T): void {
    const key = this.getOptionKey(item);
    const filteredKeys = this.toArray(this.value()).filter((id) => id !== key);
    const valueToSet = this.multi() ? filteredKeys : null;
    this.setValue(valueToSet);
  }

  // --- Core value propagation ---
  private setValue(value: any) {
    // Avoid duplicate propagation if same (compare serialized)
    let isValueChanged = true;
    try {
      const prev = this.value();
      if (JSON.stringify(prev) === JSON.stringify(value)) {
        isValueChanged = false;
        // still ensure selected is in sync (in case selected drifted)
        try {
          const resolved = this.resolveItemsFromValue(value);
          // set selected if different
          const prevSelection = this.entity();
          const newSelection = this.multi() ? resolved : resolved[0] ?? null;
          if (JSON.stringify(prevSelection) !== JSON.stringify(newSelection)) {
            this.entity.set(newSelection);
            this.entityChange.emit(newSelection);
          }
        } catch {
          // ignore
        }
        return;
      }
    } catch {
      // fallthrough
    }

    // Normalize & store the key(s) in `value`
    this.value.set(value);
    this.valueChange.emit(value);

    // Resolve and store selected object(s) from available options/items where possible.
    const resolvedItems = this.resolveItemsFromValue(value);
    const selectedToSet = this.multi() ? resolvedItems : resolvedItems.length ? resolvedItems[0] : null;
    this.entity.set(selectedToSet);
    this.entityChange.emit(selectedToSet);

    // notify Angular forms via CVA callback ONLY if value actually changed
    if (isValueChanged) {
      this.onChange(value);
    }

    // mark touched (we consider a change to be an interaction)
    this.onTouched();

    // Update parent control validity/status without setting parent value
    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity({ emitEvent: false });
      }
    } catch {
      // swallow
    }

    // ensure UI updates under OnPush
    this.cdr.markForCheck();
  }

  private setResolvedValue(value: any): void {
    // This function expects `value` to be either keys or full item objects.
    // It will set both `value` (keys) and `selected` (object(s)), and update the searchControl UI.

    if (value == null || (Array.isArray(value) && value.length === 0)) {
      // Clear both
      this.value.set(null);
      this.entity.set(null);
      this.valueChange.emit(null);
      this.entityChange.emit(null);
      this.searchControl.setValue('', { emitEvent: false });
      this.cdr.markForCheck();
      return;
    }

    if (this.multi()) {
      // Expecting array or single -> treat as array of keys or objects
      const resolvedItems = this.resolveItemsFromValue(value);
      const keys = resolvedItems.map((i) => this.getOptionKey(i)).filter((k) => k != null);

      // Avoid emitting if keys are identical to current value
      try {
        const curr = this.value();
        if (JSON.stringify(curr) !== JSON.stringify(keys)) {
          this.value.set(keys);
          this.valueChange.emit(keys);
        }
      } catch {
        this.value.set(keys);
        this.valueChange.emit(keys);
      }

      // Update entity only when changed
      try {
        const currEntity = this.entity();
        if (JSON.stringify(currEntity) !== JSON.stringify(resolvedItems)) {
          this.entity.set(resolvedItems);
          this.entityChange.emit(resolvedItems);
        }
      } catch {
        this.entity.set(resolvedItems);
        this.entityChange.emit(resolvedItems);
      }

      // show no text for multi (tags are displayed)
      this.searchControl.patchValue('', { emitEvent: false });
    } else {
      // single select: want single key stored, and label shown in searchControl
      const resolvedItems = this.resolveItemsFromValue(value);
      const first = resolvedItems.length ? resolvedItems[0] : null;
      const keyToStore = first ? this.getOptionKey(first) : Array.isArray(value) ? (value[0] ?? null) : value;

      try {
        const curr = this.value();
        if (JSON.stringify(curr) !== JSON.stringify(keyToStore)) {
          this.value.set(keyToStore);
          this.valueChange.emit(keyToStore);
        }
      } catch {
        this.value.set(keyToStore);
        this.valueChange.emit(keyToStore);
      }

      try {
        const currEntity = this.entity();
        if (JSON.stringify(currEntity) !== JSON.stringify(first)) {
          this.entity.set(first);
          this.entityChange.emit(first);
        }
      } catch {
        this.entity.set(first);
        this.entityChange.emit(first);
      }

      if (first) {
        this.searchControl.setValue(this.getOptionLabel(first), { emitEvent: false });
      } else {
        // If we couldn't resolve the object (no matching option), show empty string
        this.searchControl.setValue('', { emitEvent: false });
      }
    }

    this.cdr.markForCheck();
  }

  // Resolve item objects from a provided value (value can be keys or full item objects)
  private resolveItemsFromValue(value: any): T[] {
    // All available candidate options: user-supplied options OR currently fetched items
    const allOptions = (this.options() ?? this.items() ?? []) as T[];
    const keys = Array.isArray(value) ? value : [value];

    // If value elements are objects that look like options already, return them (preserve order)
    const maybeObjects = keys.filter((k) => k && typeof k === 'object' && this.getOptionKey(k) != null);
    if (maybeObjects.length === keys.length) {
      return maybeObjects as T[];
    }

    // Otherwise, treat keys as key values and find matching option objects
    // If an item for a key isn't present in the available options (e.g. because
    // items are coming from a search result), fall back to any previously
    // selected entities stored in `this.entity()` so multi-select doesn't lose
    // already-selected tags when they are not present in the current options.
    const found: T[] = [];
    const prevSelection = this.entity();
    const prevArr = prevSelection == null ? [] : Array.isArray(prevSelection) ? prevSelection : [prevSelection];

    for (const k of keys) {
      let match: T | undefined = undefined;
      try {
        match = allOptions.find((opt) => this.getOptionKey(opt) === k);
      } catch {
        match = undefined;
      }

      // If not found in the current option set, try previously selected entities
      if (!match && prevArr.length) {
        try {
          match = prevArr.find((opt) => this.getOptionKey(opt) === k);
        } catch {
          match = undefined;
        }
      }

      if (match) found.push(match);
      // if still not found, we don't invent objects — leave missing ones out
    }

    return found;
  }

  handleBlur() {
    this.onTouched();
    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsTouched();
        ctrl.updateValueAndValidity({ emitEvent: true });
      }
    } catch {
      // ignore
    }
    this.cdr.markForCheck();
  }

  // --- CVA Interface ---
  writeValue(value: any): void {
    // If options are not yet available, store pending and resolve later
    if (!this.options()?.length && !(this.items() && this.items().length)) {
      this.pendingRawValue = value;
    } else {
      this.setResolvedValue(value);
      this.pendingRawValue = null;
    }

    // Also clear both when null/empty
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      this.value.set(null);
      this.entity.set(null);
      this.searchControl.setValue('', { emitEvent: false });
      // Emit clears to keep parent in sync (safe to emit here)
      this.valueChange.emit(null);
      this.entityChange.emit(null);
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
    try {
      return item?.[this.optionKey()];
    } catch {
      return undefined;
    }
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
    // lazy DI for ngControl
    this.ngControl = this.injector.get(NgControl, null);
    // console.log('DIAG: ngControl =>', this.ngControl);
    // console.log('DIAG: ngControl.control =>', this.ngControl?.control);
    // console.log('DIAG: validators QueryList =>', this.validators);
    // console.log('DIAG: validators length =>', this.validators?.length);

    if (this.ngControl?.control && this.validators?.length) {
      const composed = Validators.compose(this.validators.map((v) => v.validate.bind(v)));
      const existing = this.ngControl.control.validator;
      const composedValidator = existing ? Validators.compose([existing, composed]) : composed;

      this.ngControl.control.setValidators(composedValidator);
      this.ngControl.control.updateValueAndValidity({ emitEvent: false });

      // DIAGNOSTICS — optional (kept from original)
      const ctrl = this.ngControl!.control!;
      // console.log('DIAG: control.value =>', ctrl.value);
      // console.log('DIAG: control.validator(ctrl) =>', ctrl.validator ? ctrl.validator(ctrl) : null);
      this.validators.forEach((v, i) => console.log(`DIAG: validator[${i}] ->`, v.constructor.name, '->', v.validate(ctrl)));
    }

    // Ensure selected is in sync with value if options already exist
    if (this.value() != null && (this.options() ?? this.items()).length) {
      this.setResolvedValue(this.value());
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
