import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Injector,
  input,
  model,
  output
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  ReactiveFormsModule,
  NgControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';

// Module-scoped counter for unique DOM ids. `crypto.randomUUID()` is only
// available in secure contexts (HTTPS, localhost, 127.0.0.1); on
// non-secure dev origins (e.g. *.cui via custom /etc/hosts) it's
// undefined and throws "is not a function". DOM ids only need uniqueness,
// not unpredictability.
let switchControlIdSeq = 0;

@Component({
  selector: 'switch-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SwitchControlComponent,
      multi: true
    }
  ],
  template: `
    <div class="form-check form-switch">
      <input
        class="form-check-input"
        type="checkbox"
        role="switch"
        [id]="id"
        [checked]="localValue"
        [disabled]="disabled"
        (change)="toggle($event)"
      />
      <label class="form-check-label" [for]="id">
        {{ label() }}
      </label>
    </div>
  `
})
export class SwitchControlComponent implements ControlValueAccessor {

  // optional label text
  label = input<string>('Switch');

  // convert boolean to 1/0 or boolean
  numeric = input(false);

  value = model<boolean | null>(null);
  valueChange = output<boolean | null>();

  id = `switch-control-${++switchControlIdSeq}`;

  localValue = false;
  disabled = false;

  private onChange = (_: any) => {};
  private onTouched = () => {};

  constructor(private injector: Injector, private cdr: ChangeDetectorRef) {
    queueMicrotask(() => {
      const ngControl = this.injector.get(NgControl, null);
      if (ngControl) ngControl.valueAccessor = this;
    });
  }

  toggle(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const v = input.checked;
    this.localValue = v;
    this.value.set(v);
    this.valueChange.emit(v);
    this.onChange(this.numeric() ? (v ? 1 : 0) : v);
    this.onTouched();
    this.cdr.markForCheck();
  }

  writeValue(v: any): void {
    if (v === 1 || v === '1') this.localValue = true;
    else if (v === 0 || v === '0') this.localValue = false;
    else this.localValue = !!v;

    this.value.set(this.localValue);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }
}
