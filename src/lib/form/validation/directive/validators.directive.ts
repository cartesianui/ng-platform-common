import { Directive, forwardRef, Attribute, HostListener, ElementRef, Input, Optional  } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS, ValidationErrors, NgControl } from '@angular/forms';
import { DatetimeService } from '../../../services/datetime.service';


@Directive({
    selector: '[noWhiteSpace]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => NoWhiteSpaceValidator),
            multi: true
        }
    ],
    standalone: false
})
export class NoWhiteSpaceValidator implements Validator {
  constructor(@Attribute('noWhiteSpace') public noWhiteSpace: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    return /\s/g.test(control.value) ? { whitespace: `This field do not allow white spaces` } : null;
  }
}

@Directive({
    selector: '[equalTo][formControlName],[equalTo][formControl],[equalTo][ngModel]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => EqualValidator),
            multi: true
        }
    ],
    standalone: false
})
export class EqualValidator implements Validator {
  constructor(
    @Attribute('equalTo') public equalTo: string,
    @Attribute('reverse') public reverse: string
  ) {}

  private get isReverse() {
    if (!this.reverse) {
      return false;
    }
    return this.reverse === 'true' ? true : false;
  }

  validate(control: AbstractControl): { [key: string]: any } {
    // self value
    const value = control.value;

    // second control
    const control2 = control.root.get(this.equalTo);

    // value not equal
    if (control2 && value !== control2.value && !this.isReverse) {
      return {
        equalTo: `Value don't match`
      };
    }

    // value equal and reverse
    if (control2 && value === control2.value && this.isReverse) {
      delete control2.errors.equalTo;
      if (!Object.keys(control2.errors).length) {
        control2.setErrors(null);
      }
    }

    // value not equal and reverse
    if (control2 && value !== control2.value && this.isReverse) {
      control2.setErrors({ equalTo: `Value don't match` });
    }

    return null;
  }
}

@Directive({
    selector: '[requireRelative][formControlName],[requireRelative][formControl],[requireRelative][ngModel]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => RequireRelativeValidator),
            multi: true
        }
    ],
    standalone: false
})
export class RequireRelativeValidator implements Validator {
  constructor(@Attribute('requireRelative') public requireRelative: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    // self value
    const value = control.value;

    // second control
    const control2 = control.root.get(this.requireRelative);

    // value not equal
    if (control2 && control2.value !== '' && value === '') {
      return {
        requireRelative: `This field is required`
      };
    }

    return null;
  }
}

@Directive({
    selector: '[email]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => EmailValidator),
            multi: true
        }
    ],
    standalone: false
})
export class EmailValidator implements Validator {
  constructor(@Attribute('email') public email: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    const regex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

    return !regex.test(control.value) ? { email: `This field value must be valid email` } : null;
  }
}

@Directive({
    selector: '[domainName]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => DomainValidator),
            multi: true
        }
    ],
    standalone: false
})
export class DomainValidator implements Validator {
  constructor(@Attribute('domainName') public domainName: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/g.test(control.value) ? { domainName: `This value is not a valid domain name` } : null;
  }
}

@Directive({
    selector: '[date]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => DateValidator),
            multi: true
        }
    ],
    standalone: false
})
export class DateValidator implements Validator {
  constructor(
    @Attribute('date') public date: string,
    @Attribute('minDate') public min: string = '',
    @Attribute('maxDate') public max: string = '',
    @Attribute('bsDatepicker') public bsDatepicker: string
  ) {}

  validate(control: AbstractControl): { [key: string]: any } {
    let value = control.value;

    if (this.bsDatepicker !== null) {
      value = DatetimeService.fromJSDate(control.value);
    }

    if (!DatetimeService.valid(value)) {
      return { date: `This date is invalid` };
    }

    if (this.min !== '' && (!DatetimeService.valid(this.min) || !DatetimeService.isGreater(value, this.min))) {
      return { date: `This date should be greater then ${DatetimeService.toLocal(this.min)}` };
    }

    if (this.max !== '' && (!DatetimeService.valid(this.max) || !DatetimeService.isLess(value, this.max))) {
      return { date: `This date should be less then ${DatetimeService.toLocal(this.max)}` };
    }

    return null;
  }
}

/**
 * usage as age="12|45|boolean"
 *
 */
@Directive({
    selector: '[age]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => AgeValidator),
            multi: true
        }
    ],
    standalone: false
})
export class AgeValidator implements Validator {
  constructor(
    @Attribute('age') public age: string,
    @Attribute('bsDatepicker') public bsDatepicker: unknown
  ) {}

  validate(control: AbstractControl): { [key: string]: any } {
    let value = control.value;

    if (this.bsDatepicker !== null) {
      value = DatetimeService.fromJSDate(control.value);
    }

    if (!DatetimeService.valid(value)) {
      return { age: `This date is invalid.` };
    }

    const option = this.age.split('|');
    value = parseInt(DatetimeService.timeSince(value));

    if (option[0] && value < parseInt(option[0])) {
      return { age: `Age should be greater then ${option[0]}.` };
    }

    if (option[1] && value > parseInt(option[1])) {
      return { age: `Age should be less then ${option[1]}.` };
    }

    return null;
  }
}

@Directive({
    selector: '[inCollection]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => InCollectionValidator),
            multi: true
        }
    ],
    standalone: false
})
export class InCollectionValidator implements Validator {
  constructor(
    @Attribute('inCollection') public collection: Array<string>,
    @Attribute('multiple') public multiple: boolean = false,
    @Attribute('separator') public separator: string = ','
  ) {}

  validate(control: AbstractControl): { [key: string]: any } {
    let values = [control.value];
    if (this.multiple) {
      values = control.value && typeof control.value === 'string' ? control.value.split(this.separator) : [control.value];
    }
    return values.length && values.every((value) => this.collection.indexOf(value) === -1) ? { inCollection: `This field do not allow white spaces` } : null;
  }
}

@Directive({
    selector: '[notInCollection]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => NotInCollectionValidator),
            multi: true
        }
    ],
    standalone: false
})
export class NotInCollectionValidator implements Validator {
  constructor(@Attribute('notInCollection') public collection: Array<string>) {}

  validate(control: AbstractControl): { [key: string]: any } {
    return this.collection.indexOf(control.value) !== -1 ? { notInCollection: `Given value is not allowed` } : null;
  }
}

@Directive({
    selector: '[float]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => FloatValidator),
            multi: true
        }
    ],
    standalone: false
})
export class FloatValidator implements Validator {
  /** Usage: <input float="2"> → allows up to 2 decimals */
  @Input('float') decimalPlaces: number | null = null;

  validate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    if (value == null || value === '') {
      return null; // let "required" validator handle empties
    }

    // build regex depending on allowed decimals
    const regex = this.decimalPlaces !== null
      ? new RegExp(`^\\d+(\\.\\d{1,${this.decimalPlaces}})?$`)
      : /^\d+(\.\d+)?$/;

    if (!regex.test(value)) {
      return {
        float: this.decimalPlaces !== null
          ? `Value must be a number with up to ${this.decimalPlaces} decimal places.`
          : 'Value must be a number.'
      };
    }

    return null;
  }
}

@Directive({
    selector: '[unicode]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => UnicodeValidator),
            multi: true
        }
    ],
    standalone: false
})
export class UnicodeValidator implements Validator {
  constructor(@Attribute('unicode') public unicode: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    return /^(U\+[A-F1-9]{1,6})+( U\+[A-F1-9]{1,6})*$/g.test(control.value) ? { unicode: `Invalid unicode pattern!` } : null;
  }
}

@Directive({
    selector: '[numeric]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => NumericValidator),
            multi: true
        }
    ],
    standalone: false
})
export class NumericValidator implements Validator {
  constructor(@Attribute('numeric') public numeric: string) {}

  validate(control: AbstractControl): { [key: string]: any } {
    return isNaN(control.value) ? { numeric: `This field accepts numeric values only` } : null;
  }
}
