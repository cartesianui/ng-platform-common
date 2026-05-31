import { Directive, ElementRef, HostListener, OnInit, Optional, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { roundDecimal } from '../helpers/currency.helpers';

/**
 * `[decimalFormat]` — keeps the displayed value of an editable decimal
 * `<input>` at a fixed precision (default 2dp) while leaving the underlying
 * form control value clean. Use on any editable decimal input — money
 * (unit price, line total, shipping, discount), tax rates, weights,
 * percentages, etc.
 *
 * Behaviour:
 * - On focus: shows the raw form-value so the user can edit freely (e.g.
 *   type `24` without seeing it snap to `24.00` mid-keystroke).
 * - On blur: rounds via `roundDecimal` and pads to 2dp (`.toFixed(2)`) so
 *   `24` → `24.00`, `24.1` → `24.10`, `24.150000003` → `24.15`. The form
 *   control value is updated to the rounded numeric (string-form, since
 *   the input element holds strings — the BE parses).
 * - On init / form-value change from the model side: pads to 2dp once
 *   ngModel/formControl emits its first value, so values loaded from the
 *   BE display as `24.00` not `24`.
 *
 * Usage:
 *   <input decimalFormat formControlName="unitPrice" class="form-control" />
 *
 * Why not just use the `regionalCurrency` pipe: pipes don't write back to
 * an editable input. This directive is the editable-input twin of the pipe
 * — same `roundDecimal` substrate, same 2dp default.
 */
@Directive({
  selector: 'input[decimalFormat]',
  standalone: false,
})
export class DecimalFormatDirective implements OnInit {
  private el = inject(ElementRef<HTMLInputElement>);
  @Optional() private ngControl = inject(NgControl, { optional: true });

  private readonly precision = 2;

  ngOnInit(): void {
    // Pad the initial value once the form control has it. Use a microtask
    // so we don't race ControlValueAccessor's initial write.
    queueMicrotask(() => this.formatToInput(this.readValue()));

    // Re-pad whenever the model side pushes a new value (e.g. parent
    // recalculation patches the form control, or BE-loaded edit form
    // patches lineTotal). Subscribing here keeps the display in sync
    // without users having to blur/refocus.
    this.ngControl?.valueChanges?.subscribe((v) => {
      // Skip if the input is currently focused — user is editing; the
      // blur handler will re-format.
      if (document.activeElement === this.el.nativeElement) return;
      this.formatToInput(v);
    });
  }

  @HostListener('focus')
  onFocus(): void {
    // Strip trailing zeros for editing convenience: `24.00` → `24`,
    // `24.10` → `24.1`. The form value stays untouched.
    const raw = this.readValue();
    if (raw === null || raw === undefined || raw === '') return;
    const n = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (!Number.isFinite(n)) return;
    // Display the canonical numeric string without padding.
    this.el.nativeElement.value = String(n);
  }

  @HostListener('blur')
  onBlur(): void {
    const raw = this.el.nativeElement.value;
    if (raw === null || raw === undefined || raw === '') {
      // Leave empty value alone — let validators decide if it's required.
      this.writeValue('');
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) {
      this.writeValue('');
      return;
    }
    const rounded = roundDecimal(n, this.precision);
    const padded = rounded.toFixed(this.precision);
    this.el.nativeElement.value = padded;
    this.writeValue(padded);
  }

  private readValue(): any {
    return this.ngControl?.value ?? this.el.nativeElement.value;
  }

  private writeValue(v: string): void {
    if (this.ngControl?.control) {
      this.ngControl.control.setValue(v, { emitEvent: true });
    } else {
      this.el.nativeElement.value = v;
    }
  }

  private formatToInput(v: any): void {
    if (v === null || v === undefined || v === '') return;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!Number.isFinite(n)) return;
    const padded = roundDecimal(n, this.precision).toFixed(this.precision);
    if (this.el.nativeElement.value !== padded) {
      this.el.nativeElement.value = padded;
    }
  }
}