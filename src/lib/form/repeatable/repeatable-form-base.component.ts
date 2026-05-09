import { Component, EventEmitter, Output, ChangeDetectionStrategy, input, Signal, computed } from '@angular/core';
import { FormBaseComponent } from '../form-base.component';
import { IHasForm } from '../../base.types';

@Component({
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export abstract class RepeatableFormBaseComponent<TEntity extends IHasForm<TEntity>>
  extends FormBaseComponent<TEntity>
{
  // --- INPUTS (signals) ---
  readonly data = input<TEntity>();
  readonly index = input<number>();

  // --- OUTPUT ---
  @Output() dataChange = new EventEmitter<TEntity>();

  // Optional computed if you want a stable non-null entity to work with
  readonly dataComputed: Signal<TEntity | undefined> = computed(() => this.data());

  protected emitChange() {
    if (this.formGroup.valid) {
      this.dataChange.emit(this.getEntityFromForm() as TEntity);
    }
  }

  protected save(): void {
    if (this.formGroup.valid) {
      this.dataChange.emit(this.getEntityFromForm() as TEntity);
    }
  }

  /**
   * Patch the existing `formGroup` with values from `data`, running them
   * through the entity's `formatForForm` formatters first.
   *
   * Subclasses' `dataEffect` hits this when re-syncing an already-built
   * form from a parent emission. Plain `formGroup.patchValue(data)` would
   * write API-shape values straight into the controls — fine for most
   * fields, but breaks date controls (`bsDatepicker` expects a `Date`,
   * not an ISO `Y-m-d` string) which then render as "Invalid".
   *
   * This helper builds a transient FormGroup via the entity's `toForm`
   * (which applies formatters) and copies its values into the live form,
   * preserving form-shape values for date / number / etc. fields.
   *
   * Use from a subclass like:
   *
   *   private readonly dataEffect = effect(() => {
   *     const value = this.data();
   *     if (!value) return;
   *     if (!this.formGroup) {
   *       this.formGroup = this.getFormFromEntity(value);
   *       this.addSubscriptions();
   *     } else {
   *       this.patchFormFromData(value);   // ← was: this.formGroup.patchValue(value, { emitEvent: false })
   *     }
   *   });
   */
  protected patchFormFromData(data: Partial<TEntity>): void {
    if (!this.formGroup) return;
    const formShape = this.getFormFromEntity(data).getRawValue();
    this.formGroup.patchValue(formShape, { emitEvent: false });
  }
}
