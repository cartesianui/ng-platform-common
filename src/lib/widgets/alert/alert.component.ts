import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AppAlertKind = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  standalone: false,
})
export class AlertComponent {
  @Input() kind: AppAlertKind = 'info';
  @Input() title?: string;
  @Input() dismissible: boolean = false;
  @Input() icon?: string;
  @Output() closed = new EventEmitter<void>();

  protected onClosed(): void {
    this.closed.emit();
  }
}
