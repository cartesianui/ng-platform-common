import { Component, EventEmitter, Output, ChangeDetectionStrategy, input, Signal, computed, effect, Inject, Optional } from '@angular/core';
import { FormBaseComponent } from '../form-base.component';
import { IHasForm } from '../../base.types';
import { EntityStatic, ENTITY_CONSTRUCTOR } from '../../base.types';
import { ROW_INDEX_KEY } from '../validation/validation.types';

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

  constructor(@Optional() @Inject(ENTITY_CONSTRUCTOR) entityConstructor?: EntityStatic<TEntity>) {
    super(entityConstructor);
    // Stamp this row's current position onto its own formGroup so
    // `with-validation` can scope server-side `items.<n>.<field>` errors to
    // this row only, instead of matching every row that has a same-named
    // field. Re-stamped whenever `index` changes (e.g. a sibling row above
    // this one is deleted and this row shifts up) — see repeatable-form
    // trackBy fix, which keeps this component instance (and its formGroup)
    // alive across such shifts rather than rebuilding it.
    effect(() => {
      const idx = this.index();
      if (this.formGroup && idx !== undefined) {
        (this.formGroup as any)[ROW_INDEX_KEY] = idx;
      }
    });
  }

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
