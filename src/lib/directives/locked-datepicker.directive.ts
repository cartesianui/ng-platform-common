import { Directive, ElementRef, inject } from '@angular/core';
import { BsDatepickerDirective, BsDaterangepickerDirective } from 'ngx-bootstrap/datepicker';

/**
 * Applies automatically to every `bsDatepicker`/`bsDaterangepicker` trigger app-wide (matches by
 * attribute presence, like `FixedPopupPositionDirective`, so no template opts in) and keeps a
 * locked date field from opening its calendar.
 *
 * ngx-bootstrap's `show()` checks nothing but "already open": a `readonly` input still opens the
 * calendar on click, and `[isDisabled]="true"` only greys the days out of a calendar that still
 * opens. Only a natively `disabled` input (a disabled FormControl) stays shut, because a disabled
 * input fires no click. Owner (SO edit, settled order): the Order Date was read-only, and clicking
 * it still opened the calendar.
 *
 * So the picker's own `show()` is wrapped on this instance: every route to it (the click trigger,
 * `isOpen`, `toggle()`) calls `this.show()`, and while the host is `readonly`, `disabled`, or the
 * picker's `isDisabled` is set, it does nothing. The check runs at click time, so a field that is
 * locked by a binding (`[readonly]="isSettled()"`) opens again as soon as the binding clears.
 * Editable fields, the value, and its format are untouched.
 */
@Directive({
  selector: '[bsDatepicker], [bsDaterangepicker]',
  standalone: true
})
export class LockedDatepickerDirective {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    const picker =
      inject(BsDatepickerDirective, { self: true, optional: true }) ??
      inject(BsDaterangepickerDirective, { self: true, optional: true });
    if (!picker) return;

    const show = picker.show.bind(picker);
    picker.show = () => {
      if (this.isLocked(picker.isDisabled)) return;
      show();
    };
  }

  private isLocked(pickerDisabled?: boolean): boolean {
    const host = this.el.nativeElement;
    return !!host.readOnly || !!host.disabled || !!pickerDisabled;
  }
}
