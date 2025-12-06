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
  ChangeDetectorRef,
  Injector
} from '@angular/core';
import {
  ReactiveFormsModule,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NgControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'boolean-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BooleanControlComponent),
      multi: true
    }
  ],
  template: `
   <div class="p-2 d-flex gap-4">
      <label class="d-flex align-items-center gap-2">
        <input
          type="radio"
          name="bool"
          class="form-check-input"
          [checked]="value() === true"
          (change)="set(true)"
        />
        <span>{{ yesLabel() }}</span>
      </label>

      <label class="d-flex align-items-center gap-2">
        <input
          type="radio"
          name="bool"
          class="form-check-input"
          [checked]="value() === false"
          (change)="set(false)"
        />
        <span>{{ noLabel() }}</span>
      </label>
   </div>
  `
})
export class BooleanControlComponent implements ControlValueAccessor {
  protected injector = inject(Injector);
  protected cdr = inject(ChangeDetectorRef);
  protected ngControl: NgControl | null = null;

  // text labels customisable (optional)
  yesLabel = input('Yes');
  noLabel  = input('No');

  // numeric mode
  numeric = input(false); // if true ⇒ write 1/0

  value = model<boolean | null>(null);
  valueChange = output<boolean | null>();

  onChange = (_: any) => {};
  onTouched = () => {};

  constructor() {
    queueMicrotask(() => {
      this.ngControl = this.injector.get(NgControl, null);
      if (this.ngControl) this.ngControl.valueAccessor = this;
    });
  }

  set(v: boolean) {
    this.value.set(v);
    this.valueChange.emit(v);
    this.onChange(this.numeric() ? (v ? 1 : 0) : v);
    this.onTouched();
    this.cdr.markForCheck();
  }

  writeValue(value: any): void {
    if (value === 1 || value === '1') this.value.set(true);
    else if (value === 0 || value === '0') this.value.set(false);
    else this.value.set(value === true);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.cdr.markForCheck();
  }
}

