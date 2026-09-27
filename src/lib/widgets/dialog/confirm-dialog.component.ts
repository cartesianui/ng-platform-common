import { Component, TemplateRef } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { AppDialogKind } from './dialog.types';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  standalone: false,
})
export class ConfirmDialogComponent {
  title: string = 'Confirm';
  message?: string;
  template?: TemplateRef<any>;
  templateContext: any;
  kind: AppDialogKind = 'info';
  okLabel: string = 'Confirm';
  cancelLabel: string = 'Cancel';

  result: boolean = false;

  constructor(public modalRef: BsModalRef) {}

  protected get kindClass(): string {
    return `app-dialog--${this.kind}`;
  }

  /**
   * Save button color follows the *action's* severity, not the header tone.
   * - `danger` kind → destructive action → red button.
   * - `success` kind → completion / approval → green button.
   * - `warning` + `info` → the header sets the tone; the button is primary
   *    so it doesn't read as a yellow caution-tape rectangle that competes
   *    with the icon.
   */
  protected get okButtonClass(): string {
    switch (this.kind) {
      case 'danger': return 'btn btn-danger';
      case 'success': return 'btn btn-success';
      default: return 'btn btn-primary';
    }
  }

  protected get iconClass(): string {
    switch (this.kind) {
      case 'success': return 'fa-solid fa-check-circle';
      case 'warning': return 'fa-solid fa-exclamation-triangle';
      case 'danger': return 'fa-solid fa-exclamation-circle';
      default: return 'fa-solid fa-info-circle';
    }
  }

  confirm(): void {
    this.result = true;
    this.modalRef.hide();
  }

  cancel(): void {
    this.result = false;
    this.modalRef.hide();
  }
}