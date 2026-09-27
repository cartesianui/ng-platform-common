import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[dtDetail]',
  standalone: true
})
export class DatatableDetailDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}