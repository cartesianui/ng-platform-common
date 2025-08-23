import { ChangeDetectionStrategy, Component, EventEmitter, Injector, Input, OnChanges, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { TypeaheadMatch } from 'ngx-bootstrap/typeahead';
import { BaseComponent } from '../../components/base.component';
import { ControlValueAccessor, SelectControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';
import { ValidationService } from '../../form/validation';

@Component({
  selector: 'lookup-widget, .lookup-widget',
  templateUrl: './lookup-widget.component.html',
  styleUrls: ['./lookup-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})

//export class LookupWidgetComponent<T> extends SelectControlValueAccessor implements OnChanges, ControlValueAccessor, Validator {
export class LookupWidgetComponent<T> implements OnChanges {
  @Input() optionField: string = 'name'; // namig convention origin from typeaheadOptionField

  @Input() options: Array<T> = [];
  @Input() ignoreOptions: Array<T> = [];

  @Input() multiValue: boolean = false; // TODO: Add some logic to allow or not allow multiple selected values
  @Input() multiValueSeparator: string = ',';

  @Input() viewMode: 'multi' | 'dropdown' = 'multi';
  @Input() actionOnSelect?: (selectedItem: any) => void;

  // My intention is to modify selected & selectedChange TO value & valueChange
  @Input() selected: Array<T> = [];
  @Output() selectedChange: EventEmitter<Array<T>> = new EventEmitter<Array<T>>();
  @Input() value: string | string[]; // can provide id or array of id's

  @Output() validityChange = new EventEmitter<boolean>();

  formControl: FormControl;

  constructor(
    protected injector: Injector,
    protected formValidator: ValidationService
  ) {
    //super(injector);
  }

  ngOnChanges() {
    this.filter();
    const validOptions = this.options.map((option) => option[this.optionField] ?? option);
    this.formControl = new FormControl(this.viewMode === 'dropdown' ? null : '', [Validators.required, this.formValidator.inValidator(validOptions, true)]);

    // Pre-fill selected based on value
    this.hydrateSelectedFromValue();

    // Emit initial validity state
    this.validityChange.emit(this.formControl.valid);

    // Emit on every change
    this.formControl.statusChanges.subscribe(() => {
      this.validityChange.emit(this.formControl.valid);
    });
  }

  // private hydrateSelectedFromValue(): void {
  //   if (!this.options || !this.value) return;

  //   const values = Array.isArray(this.value) ? this.value : this.value.toString().split(this.multiValueSeparator);

  //   const matchedOptions = this.options.filter((option) => values.includes(option['id']));

  //   if (!matchedOptions.length) return;

  //   this.selected = matchedOptions;
  //   // this.selectedChange.emit(this.selected); // I commented this line and it is working fine i only want to use this on start, all other function should remain sa,e

  //   // For dropdown view, show the first selected option in the input
  //   if (this.viewMode === 'dropdown') {
  //     const firstSelected = matchedOptions[0];
  //     const displayValue = firstSelected[this.optionField];

  //     this.formControl.setValue(displayValue, { emitEvent: false });
  //     this.formControl.markAsTouched();
  //     this.formControl.updateValueAndValidity();
  //   } else {
  //     // 'multi' view mode: show multiple values as a comma-separated string (or custom separator)
  //     const displayValues = matchedOptions.map((option) => option[this.optionField]);
  //     const joinedValues = displayValues.join(this.multiValueSeparator);

  //     this.formControl.setValue(joinedValues, { emitEvent: false });
  //     this.formControl.markAsTouched();
  //     this.formControl.updateValueAndValidity();
  //   }
  // }

  private hydrateSelectedFromValue(): void {
    if (!this.options || !this.value || !this.formControl) return;

    const values = Array.isArray(this.value) ? this.value : this.value.toString().split(this.multiValueSeparator);

    const matchedOptions = this.options.filter(
      (option) => values.includes(option['id']) // Match by ID only
    );

    if (!matchedOptions.length) return;

    this.selected = matchedOptions;
    // Don't emit selectedChange – you only want this on init
    // this.selectedChange.emit(this.selected);

    if (this.viewMode === 'dropdown') {
      const firstSelected = matchedOptions[0];
      const displayValue = firstSelected[this.optionField];

      this.formControl.setValue(displayValue, { emitEvent: false });
    } else {
      const displayValues = matchedOptions.map((option) => option[this.optionField]);
      const joinedValues = displayValues.join(this.multiValueSeparator);

      this.formControl.setValue(joinedValues, { emitEvent: false });
    }

    // Optional: only mark as touched if needed
    this.formControl.updateValueAndValidity();
  }

  onSelect(match: TypeaheadMatch) {
    console.log(match);
    if (this.formControl.valid) {
      const value = match?.value ?? null;
      let values = value.split(this.multiValueSeparator);
      let current = this.options.filter((o) => values.indexOf(o[this.optionField]) !== -1);
      this.selected.push(...current);
      //this.formControl.setValue(''); // don't make empty retain last value selected
    }
  }

  onDropdownChange(match: TypeaheadMatch) {
    const selectedItem = match?.item;

    if (!selectedItem) return;

    // Update form control with the display value (e.g., name)
    this.formControl.setValue(selectedItem[this.optionField], { emitEvent: false });
    this.formControl.markAsTouched();
    this.formControl.updateValueAndValidity();

    this.selectedChange.emit(selectedItem);

    if (this.actionOnSelect) {
      this.actionOnSelect(selectedItem);
    } else {
      this.selected = [selectedItem];
    }
  }

  // onDropdownChange(match: TypeaheadMatch) {
  //   const optionValue = match?.value ?? null;
  //   //this.value = optionValue;
  //   this.formControl.setValue(optionValue);
  //   this.formControl.markAsTouched();
  //   this.formControl.updateValueAndValidity();

  //   this.selectedChange.emit(match.item);

  //   if (this.actionOnSelect) {
  //     this.actionOnSelect(match.item);
  //   } else {
  //     this.selected.push(match.item);
  //   }
  // }

  onDelete(i: number) {
    this.selected.splice(i, 1);
  }

  filter() {
    if (this.ignoreOptions?.length) {
      this.options = this.options.filter((o) => {
        // some returns true, if o exists in ignore list
        return !this.ignoreOptions.some((i) => {
          return o[this.optionField] === i[this.optionField];
        });
      });
    }
  }

  onType(value: string) {
    // console.log('User typed:', value);
  }

  // Validator interface
  // validate(control: AbstractControl): ValidationErrors | null {
  //   if (this.required && !this.value) {
  //     return { required: true };
  //   }
  //   return null;
  // }
}
