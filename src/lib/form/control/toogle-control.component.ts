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
  FormsModule,
  ReactiveFormsModule,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NgControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonsModule } from 'ngx-bootstrap/buttons';

@Component({
  selector: 'toggle-control',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: BooleanToggleControlComponent,
      multi: true
    }
  ],
  template: `
    <button
      type="button"
      class="btn"
      btnCheckbox
      [btnCheckboxTrue]="trueValue"
      [btnCheckboxFalse]="falseValue"
      [(ngModel)]="localValue"
      (ngModelChange)="onValueChanged($event)"
    >
      {{ localValue ? yesLabel() : noLabel() }}
    </button>
  `
})
export class BooleanToggleControlComponent implements ControlValueAccessor {

  yesLabel = input('Yes');
  noLabel  = input('No');

  numeric  = input(false);

  // CVA model
  value = model<boolean | null>(null);
  valueChange = output<boolean | null>();

  // for btnCheckbox
  trueValue = true;
  falseValue = false;
  localValue: boolean = false;

  private onChange = (_: any) => {};
  private onTouched = () => {};

  constructor(private injector: Injector, private cdr: ChangeDetectorRef) {
    queueMicrotask(() => {
      const ngControl = this.injector.get(NgControl, null);
      if (ngControl) ngControl.valueAccessor = this;
    });
  }

  onValueChanged(v: boolean) {
    this.localValue = v;
    this.value.set(v);
    this.valueChange.emit(v);
    this.onChange(this.numeric() ? (v ? 1 : 0) : v);
    this.onTouched();
    this.cdr.markForCheck();
  }

  writeValue(v: any) {
    let bool = false;
    if (v === 1 || v === '1') bool = true;
    else if (v === 0 || v === '0') bool = false;
    else bool = !!v;

    this.localValue = bool;
    this.value.set(bool);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
}
