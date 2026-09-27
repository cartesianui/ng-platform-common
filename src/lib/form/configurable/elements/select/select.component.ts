import { AfterViewChecked, Component, EventEmitter, OnChanges, OnInit, Input, Output } from '@angular/core';
import { FormGroup, ValidatorFn } from '@angular/forms';
import { ValidationService } from '../../../validation/validation.service';
import { IFormField } from '../../models/form-field.model';

@Component({
    selector: 'form-select',
    templateUrl: './select.component.html',
    standalone: false
})
export class SelectComponent implements OnInit, AfterViewChecked {
  @Input() config: IFormField;
  @Input() formGroup: FormGroup;
  @Output() changed?: EventEmitter<Event> = new EventEmitter();
  @Output() clicked?: EventEmitter<Event> = new EventEmitter();

  validators: ValidatorFn[];
  formValidatorService: ValidationService;

  constructor(formValidatorService: ValidationService) {
    this.formValidatorService = formValidatorService;
  }

  ngOnInit(): void {
    this.validators = this.config.validators;
  }

  ngAfterViewChecked(): void {
    if (this.validators !== this.config.validators) {
      this.validators = this.config.validators;
      const ctrl = this.formGroup.controls[this.config.name];
      ctrl.setValidators(this.validators);
      ctrl.updateValueAndValidity();
    }
  }

  getFormClasses(): string {
    const control = this.formGroup.controls[this.config.name];
    return this.formValidatorService.getFormClasses(control);
  }
}
