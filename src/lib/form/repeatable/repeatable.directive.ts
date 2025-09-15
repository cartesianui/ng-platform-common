import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[repeatable]',
  exportAs: 'repeatable'
})
export class RepeatableDirective {
  public componentInstance: any;
  public index!: number;

  constructor(public el: ElementRef) {}
}