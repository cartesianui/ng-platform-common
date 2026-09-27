import { Directive, Input, Optional, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

// Usage: input[validate], textarea[validate], select[validate], lookup-widget[validate]
@Directive({
    selector: '[validate]',
    standalone: false
})
export class ValidateDirective {
  @Input() controlName?: string; 

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (!ngControl) {
      console.warn('[ValidateDirective] No form control found on element with [validate] attribute.');
    }
  }
}
