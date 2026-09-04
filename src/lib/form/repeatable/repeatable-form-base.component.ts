import { Component, EventEmitter, Output, ChangeDetectionStrategy, input, Signal, computed, effect, Inject, Optional } from '@angular/core';
import { FormBaseComponent } from '../form-base.component';
import { IHasForm } from '../../base.types';
import { EntityStatic, ENTITY_CONSTRUCTOR } from '../../base.types';
import { ROW_INDEX_KEY, ROW_VALID_KEY } from '../validation/validation.types';

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

  /**
   * The parent document is closed to edits, so this row is too (UF-P1.6).
   *
   * Disabling the row's own `formGroup` rather than rendering a second,
   * read-only template: one template stays the single description of what a
   * row looks like, and a disabled control cannot be typed into, tabbed into,
   * or submitted. The parent removes Add / Remove via `repeatable-form`'s own
   * `readonly` input — this input has no reach outside its row.
   */
  readonly locked = input<boolean>(false);

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

    // Runs after the row builds its form (edit rows build theirs in their own
    // `dataEffect`), and again if the flag flips — a draft that gets issued
    // while the screen is open turns read-only without a reload.
    effect(() => {
      const locked = this.locked();
      if (!this.formGroup) return;
      if (locked && this.formGroup.enabled) this.formGroup.disable({ emitEvent: false });
      if (!locked && this.formGroup.disabled) this.formGroup.enable({ emitEvent: false });
    });
  }

  /**
   * Stamp this row's index onto its formGroup, defensively.
   *
   * QA Q6-B7/B9 — the constructor effect above is not sufficient on its own.
   * It reads `this.formGroup`, but EDIT rows build their formGroup later (in
   * their own `dataEffect`, once `data()` arrives), so at first run the form
   * does not exist yet — and because `index()` never changes afterwards, the
   * effect never re-runs and **the stamp never lands**.
   *
   * With no stamp, `with-validation.findRowIndex()` returns undefined and
   * falls back to suffix matching, where `items.2.sku_id` ends with
   * `.sku_id` and therefore matches the SKU control on EVERY row. That is
   * the reported symptom exactly: one bad line, and all three rows show
   * "The items.2.sku_id field is required."
   *
   * Called from the places that run once a form definitely exists, so the
   * stamp is present by the time any server error is rendered.
   */
  protected stampRowIndex(): void {
    const idx = this.index();
    if (this.formGroup && idx !== undefined) {
      (this.formGroup as any)[ROW_INDEX_KEY] = idx;
    }
  }

  // --- OUTPUT ---
  @Output() dataChange = new EventEmitter<TEntity>();

  // Optional computed if you want a stable non-null entity to work with
  readonly dataComputed: Signal<TEntity | undefined> = computed(() => this.data());

  /**
   * Push this row's current values up to the parent — **valid or not**.
   *
   * QA Q6-B7/B9. This used to emit only `if (this.formGroup.valid)`, which
   * meant a half-filled row never reached the parent at all. The parent kept
   * the empty `{}` that `repeatable-form.add()` seeded, and posted THAT:
   *
   *   - the operator types a SKU and a quantity but no unit cost;
   *   - the row is invalid, so nothing is emitted;
   *   - the parent still holds `{}` and sends a blank line;
   *   - the server answers "items.2.sku_id is required" for a SKU that is
   *     plainly visible on screen.
   *
   * It also made the errors unclearable — filling ONE missing field does not
   * make the row valid, so the parent kept the same `{}` and the next save
   * failed identically. That is the "errors persist after the missing value
   * is entered" half of the report.
   *
   * The parent must mirror what is on screen. Completeness is enforced at
   * submit instead: `markRowValidity` tags each row, and the parent refuses
   * to save while any line is incomplete — surfacing the mistake rather than
   * discarding the row.
   *
   * `save()` below keeps its validity guard: that is an explicit per-row
   * commit, not the continuous mirror.
   */
  protected emitChange() {
    this.stampRowIndex();
    this.dataChange.emit(this.markRowValidity(this.getEntityFromForm() as TEntity));
  }

  /**
   * Tag the emitted row with its own validity so the parent can refuse to
   * submit an incomplete line.
   *
   * A row is a separate component with its OWN FormGroup, so the parent
   * document's `formGroup.valid` says nothing about whether the lines are
   * complete — which is why an incomplete row could be submitted at all.
   * Rows now always emit (see `emitChange`), so the parent needs some way to
   * tell a finished line from an unfinished one.
   *
   * Written NON-ENUMERABLE on purpose: `JSON.stringify` skips it, so it never
   * reaches the request body and no BE validation has to know about it.
   */
  protected markRowValidity(entity: TEntity): TEntity {
    Object.defineProperty(entity, ROW_VALID_KEY, {
      value: this.formGroup?.valid ?? false,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return entity;
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
    // The form may have been built after the constructor effect ran (edit
    // rows do exactly that), so take this opportunity to stamp the row index.
    this.stampRowIndex();
  }
}
