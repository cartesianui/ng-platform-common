import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[repeaterItem]',
  exportAs: 'repeaterItem'
})
export class RepeaterItemDirective {
  public componentInstance: any;
  public index!: number;

  constructor(public el: ElementRef) {}
}