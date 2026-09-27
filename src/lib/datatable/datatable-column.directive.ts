import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: '[dtColumn]',
  standalone: true
})
export class DatatableColumnDirective {
  @Input('dtColumn') columnKey: string;
  @Input() columnName: string = '';
  @Input() columnWidth: number;

  constructor(public templateRef: TemplateRef<any>) {}
}