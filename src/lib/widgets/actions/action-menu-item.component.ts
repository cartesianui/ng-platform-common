import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from '@angular/core';

/**
 * One entry of the "Actions" dropdown on the shared page-action bar.
 *
 * Project it into `<default-actions>` / `<page-actions>`; the bar collects every
 * `<action-menu-item>` and renders them in ONE "Actions" dropdown that sits to the left of
 * Save, so a secondary action (Create Delivery Note, Cancel...) cannot be hit by a
 * mis-click aimed at Save. The item itself renders nothing where it is declared: the bar
 * stamps its label into the menu.
 *
 * ```html
 * <default-actions (save)="onSave()">
 *   <action-menu-item *ngIf="canShip()" icon="fa-solid fa-truck" [busy]="shipping()" (select)="onShip()">
 *     Create Delivery Note
 *   </action-menu-item>
 *   <action-menu-item icon="fa-solid fa-file-invoice-dollar" [disabled]="!!billBlockedReason()" [hint]="billBlockedReason()" (select)="onCreateBill()">
 *     Create Bill
 *   </action-menu-item>
 *   <action-menu-item *ngIf="canCancel()" icon="fa-solid fa-ban" danger (select)="openCancelDialog()">
 *     Cancel&hellip;
 *   </action-menu-item>
 * </default-actions>
 * ```
 *
 * - Hide an item with `*ngIf`; when no item is present the whole dropdown is hidden.
 * - `danger` items are listed last, after a divider, in `text-danger`.
 * - `disabled` items stay listed but cannot be chosen; `busy` swaps the icon for a spinner
 *   and also disables the item.
 * - `hint` adds a muted explanation line (and tooltip) under the label, e.g. why it is disabled.
 * - The menu closes on select.
 * - Plain `<button>`s projected into the bar still render inline as before (back-compat).
 */
@Component({
  selector: 'action-menu-item',
  template: `<ng-template #label><ng-content></ng-content></ng-template>`,
  standalone: false
})
export class ActionMenuItemComponent {
  /** Font Awesome classes for the leading icon, e.g. `fa-solid fa-truck`. */
  @Input() icon: string = '';

  /** Destructive action: grouped last, after a divider, styled `text-danger`. */
  @Input()
  set danger(value: boolean | string) {
    this._danger = value === '' || value === true || value === 'true';
  }
  get danger(): boolean {
    return this._danger;
  }
  private _danger = false;

  /** Shown but not selectable. */
  @Input() disabled: boolean = false;

  /**
   * Optional short explanation, shown as a small muted line under the label and as the item's
   * tooltip. Mainly for a disabled item saying why, e.g. a backend `create_bill_blocked_reason`.
   * Long hints wrap inside the menu; they never widen the action bar.
   */
  @Input() hint: string | null = null;

  /** Work in flight: shows a spinner in place of the icon and disables the item. */
  @Input() busy: boolean = false;

  /** Fired when the user chooses this item. */
  @Output() select: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  /** The projected label, rendered by the action bar inside the dropdown. */
  @ViewChild('label', { static: true }) label: TemplateRef<unknown>;

  get isDisabled(): boolean {
    return this.disabled || this.busy;
  }

  choose(event: MouseEvent): void {
    if (this.isDisabled) {
      return;
    }
    this.select.emit(event);
  }
}
