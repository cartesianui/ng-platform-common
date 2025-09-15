import { Directive, Input, OnInit, ElementRef } from '@angular/core';
import { PermissionCheckerService } from '@cartesianui/core';

@Directive({
  selector: '[accessible]'
})
export class AccessibleDirective implements OnInit {
  @Input() permissions: string[];

  constructor(private _element: ElementRef, private permissionCheckerService: PermissionCheckerService) {}

  ngOnInit() {
    this._element.nativeElement.style.display = 'none';
    this.canAccess();
  }

  canAccess() {
    this._element.nativeElement.style.display = this.permissionCheckerService.isGranted('') ? 'block' : 'none';
  }
}
