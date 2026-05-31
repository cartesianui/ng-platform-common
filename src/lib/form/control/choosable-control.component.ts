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
  OnDestroy,
  Injector,
  ChangeDetectorRef,
  Inject,
  Optional,
  computed
} from '@angular/core';
import {
  ReactiveFormsModule,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NgControl,
  Validators,
  NG_VALIDATORS,
  Validator
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription, asapScheduler, observeOn } from 'rxjs';

@Component({
  selector: 'choosable-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChoosableControlComponent),
      multi: true
    }
  ],
  template: `
   <div class="choosable-control" [class.cc--mode-buttons]="mode() === 'buttons'">
      <div class="form-control p-2">
        <div *ngIf="items()?.length; else noOptions"
             class="checkbox-grid"
             [ngStyle]="{'grid-template-columns': 'repeat(' + cols() + ', 1fr)'}">
          <label
            class="d-flex align-items-center mb-1"
            *ngFor="let item of items(); trackBy: trackByKey"
          >
            <input
              type="{{ multi() ? 'checkbox' : 'radio' }}"
              [name]="multi() ? optionKey() : radioGroupName"
              class="form-check-input me-2"
              [checked]="isSelected(item)"
              (change)="onToggle(item, $event.target.checked)"
            />
            <span>{{ getOptionLabel(item) }}</span>
          </label>
        </div>
        <ng-template #noOptions>
          <div class="text-muted small">No options available</div>
        </ng-template>
      </div>
    </div>
  `,
  styleUrls: ['./choosable-control.component.scss']
})
export class ChoosableControlComponent<T = any>
  implements OnDestroy, ControlValueAccessor
{
  protected injector = inject(Injector);
  protected cdr = inject(ChangeDetectorRef);
  protected http = inject(HttpClient);

  protected subs = new Subscription();
  protected ngControl: NgControl | null = null;

  // --- Inputs ---
  url = input<string | null>(null);
  options = input<T[] | null>(null);
  ignoreOptions = input<T[]>([]);
  multi = input(false);
  cols = input<number>(1);
  optionKey = input<string>('id');
  optionField = input('name');
  /**
   * Visual rendering mode.
   *  - 'default' (radio button + label, original look)
   *  - 'buttons' (segmented track; active option highlighted)
   * Variants are visual only — value-binding behaviour is identical.
   */
  mode = input<'default' | 'buttons'>('default');

  // --- Two-way bound model ---
  value = model<T[keyof T][] | T[keyof T] | null>(null);
  valueChange = output<T[keyof T][] | T[keyof T] | null>();

  // --- Internal state ---
  items = signal<T[]>([]);
  // Unique radio group name per component instance to prevent different
  // instances' radio inputs from being grouped together by the browser.
  readonly radioGroupName = `choosable-radio-${Math.random().toString(36).slice(2, 9)}`;

  readonly optionsEffect = effect(() => {
    const opts = this.options();
    if (!opts?.length) return;
    // Resolve any pending value captured by writeValue before options arrived.
    if (this.pendingValue != null) {
      this.setResolvedValue(this.pendingValue);
      this.pendingValue = null;
      return;
    }
    // Defensive: if the form control has a value but our internal value()
    // signal is null (writeValue ran in a previous cycle with empty options,
    // or an embedded view did not re-trigger writeValue when options arrived),
    // resolve from the bound NgControl's current value. Without this, radios
    // render but none appear checked even though the form control is valid.
    const ngVal = this.ngControl?.value;
    if (this.value() == null && ngVal != null) {
      this.setResolvedValue(ngVal);
    }
  });

  private pendingValue: any = null;

  // --- CVA Callbacks ---
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(@Optional() @Inject(NG_VALIDATORS) private validators: Validator[] = []) {
    queueMicrotask(() => {
      this.ngControl = this.injector.get(NgControl, null);
      if (this.ngControl) this.ngControl.valueAccessor = this;
    });

    // load options (local or remote)
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
  }

  // --- Interaction handlers ---
  onToggle(item: T, checked: boolean) {
    const key = this.getOptionKey(item);
    const current = this.toArray(this.value());

    let updated;
    if (this.multi()) {
      updated = checked
        ? [...current, key]
        : current.filter((k) => k !== key);
    } else {
      updated = checked ? key : null;
    }

    this.setValue(this.multi() ? updated : updated);
  }

  isSelected(item: T): boolean {
    const key = this.getOptionKey(item);
    const val = this.value();
    return Array.isArray(val) ? val.includes(key) : val === key;
  }

  // --- Core value propagation ---
  private setValue(value: any) {
    try {
      const prev = this.value();
      if (JSON.stringify(prev) === JSON.stringify(value)) return;
    } catch {}

    this.value.set(value);
    this.valueChange.emit(value);
    this.onChange(value);
    this.onTouched();

    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity({ emitEvent: true });
      }
    } catch {}

    this.cdr.markForCheck();
  }

  private setResolvedValue(value: any): void {
    if (value == null) {
      this.value.set(null);
      this.cdr.markForCheck();
      return;
    }

    if (this.multi()) {
      const items = this.resolveItemsFromValue(value);
      const keys = items.map((i) => this.getOptionKey(i));
      this.value.set(keys);
    } else {
      const items = this.resolveItemsFromValue(value);
      const first = items.length ? items[0] : null;
      const key = first ? this.getOptionKey(first) : value;
      this.value.set(key);
    }

    this.cdr.markForCheck();
  }

  private resolveItemsFromValue(value: any): T[] {
    const allOptions = (this.options() ?? this.items() ?? []) as T[];
    const keys = Array.isArray(value) ? value : [value];
    const maybeObjects = keys.filter(
      (k) => k && typeof k === 'object' && this.getOptionKey(k) != null
    );
    if (maybeObjects.length === keys.length) return maybeObjects as T[];

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

  // --- CVA Interface ---
  writeValue(value: any): void {
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      if (!this.options()?.length) {
        this.pendingValue = value;
        return;
      }
      this.setResolvedValue(value);
      return;
    }

    if (!this.options()?.length) {
      this.pendingValue = value;
      return;
    }

    this.setResolvedValue(value);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cdr.markForCheck();
  }

  // --- Helpers ---
  getOptionKey(item: T): any {
    return item?.[this.optionKey()];
  }
  getOptionLabel(item: T): string {
    const field = this.optionField();
    return (item && (item as any)[field]) ?? String(item);
  }

  private toArray(value: any): any[] {
    return Array.isArray(value) ? value : value != null ? [value] : [];
  }

  trackByKey = (index: number, item: any) =>
    this.getOptionKey(item) ?? index;

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
