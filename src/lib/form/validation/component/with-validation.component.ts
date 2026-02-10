import { Component, ContentChild, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { ValidateDirective } from '../directive/validate.directive';
import { ValidationService } from '../validation.service';
import { HttpErrorService, IError } from '@cartesianui/core';
import { ValidationErrors } from '@angular/forms';

@Component({
    selector: 'with-validation',
    template: `
      <div class="component-wrapper">
        <ng-content></ng-content>
        <div class="invalid-feedback" [innerHTML]="errorMessage"></div>
      </div>
    `,
    styles: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WithValidationComponent implements OnInit, AfterContentInit {
  @ContentChild(ValidateDirective, { static: true }) validateDirective!: ValidateDirective;

  constructor(
    private validationOberverService: ValidationService,
    private errorService: HttpErrorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (!this.validateDirective) {
      throw new Error('Without validate directive <with-validation></with-validation> is a useless component!');
    }
   
    this.errorService.serverErrors$.subscribe((errors) => this.setServerError(errors, this.validateDirective));
  }

  ngAfterContentInit(): void {
    const control = this.validateDirective.ngControl?.control;
    if (control) {
      control.statusChanges.subscribe(() => this.cdr.markForCheck());
    }
  }

  get errorMessage(): string | null {
    const errors = Object.entries(this.validateDirective?.ngControl?.control?.errors || {});

    // if(this.validateDirective?.ngControl?.name == "classId") {
    //   console.log(this.validateDirective?.ngControl);
    //   console.log(errors);
    // }

    if (!this.validateDirective?.ngControl?.dirty && !this.validateDirective?.ngControl?.touched) return '';
    if (!errors.length) {
      return null;
    }

    const passedControlName = this.validateDirective?.controlName;
    const formControlName = passedControlName ?? (this.validateDirective?.ngControl?.name as string) ?? 'This Field';
    return this.validationOberverService.getErrorValidationMessage(this.humanReadable(formControlName), errors);
  }

  setServerError(errors: IError, validateDirective) {
    const control = validateDirective?.ngControl?.control;
    const fieldErrors = errors[validateDirective?.ngControl?.name];

    if (control && fieldErrors) {
      control.setErrors({
        ...control.errors,
        serverError: this.formatErrorsAsHtml(fieldErrors)
      } as ValidationErrors);

      // 👇 Mark control as touched so error displays immediately
      control.markAsTouched();
      
      // Optionally: control.markAsDirty(); if your app uses that check
      control.markAsDirty();

      // 👉 Tell Angular to re-check the component
      this.cdr.markForCheck();

    }
  }

  private humanReadable(name: string): string {
    // Remove 'Id' suffix (e.g., 'vendorId' -> 'vendor')
    const cleanName = name.replace(/Id$/, '');

    return cleanName
      .replace(/(?<=[a-zA-Z])(?=[A-Z])/g, ' ')
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  private formatErrorsAsHtml(errors: string | string[]): string {
    const errorArray = Array.isArray(errors)
      ? errors
      : errors
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

    return errorArray
      .map((err) => err.replace(/[.,]$/, '').trim())
      .filter(Boolean)
      .map((err) => `${err}.`)
      .join('<br>');
  }
}
