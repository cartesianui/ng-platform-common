import { Inject, Optional, Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { BaseComponent } from '../base.component';
import { ChildComponent, EntityStatic, ENTITY_CONSTRUCTOR } from '../base.types';
import { IHasForm } from '../base.types';
import { projectNestedFormFields } from '../models/utils';
import { RequestState } from '../store';
@Component({
    template: '',
    standalone: false
})
export abstract class FormBaseComponent<TEntity extends IHasForm<TEntity>, TChildComponent extends ChildComponent = {}> extends BaseComponent<TChildComponent> {
  @ViewChild('formContainer', { static: false }) formContainer!: ElementRef;

  @Output() created: EventEmitter<TEntity | boolean> = new EventEmitter();

  @Output() updated: EventEmitter<TEntity | boolean> = new EventEmitter();

  formGroup: FormGroup;

  /**
   *
   * @param injector
   * @param entityConstructor generic way to construct entity/domain model instance
   */
  constructor(
    @Optional() @Inject(ENTITY_CONSTRUCTOR) protected entityConstructor?: EntityStatic<TEntity>
  ) {
    super();
  }

  protected initForm() {
    this.formGroup = this.getFormFromEntity();
  }

  /**
   * Subclasses with nested collections (items, lines, charges, attachments,
   * ...) override this to declare them. The collections are merged onto the
   * entity inside `getEntityFromForm`, then projected through
   * `projectNestedFormFields` so each child ships only its declared form
   * fields.
   *
   * Why a hook rather than convention-by-name: avoids hardcoding `items`,
   * supports any number of collections per page, and keeps the merge a
   * single explicit place rather than scattered `entity.x = this.x`
   * assignments before each save call.
   */
  protected getNestedCollections(): Record<string, any> {
    return {};
  }

  protected getEntityFromForm(formGroup?: FormGroup): TEntity {
    const entity = new this.entityConstructor().fromForm(formGroup ?? this.formGroup);
    Object.assign(entity, this.getNestedCollections());
    // Recursively project nested model instances (items/lines/charges/etc.)
    // through pickFormFields, so parent forms ship a clean payload without
    // knowing their child constructors. See projectNestedFormFields docs.
    return projectNestedFormFields(entity) as TEntity;
  }

  protected getFormFromEntity(entity?: Partial<TEntity>): FormGroup {
    return new this.entityConstructor().toForm(entity);
  }

  // protected getEntityFromForm(formGroup?: FormGroup): TEntity {
  //   if (!this.entityConstructor?.fromForm) {
  //     throw new Error('Missing static fromForm method on entity constructor');
  //   }
  //   return this.entityConstructor.fromForm(formGroup ?? this.formGroup);
  // }

  // protected getFormFromEntity(entity?: Partial<TEntity>): FormGroup {
  //   if (!this.entityConstructor?.fromForm) {
  //     throw new Error('Missing static fromForm method on entity constructor');
  //   }
  //   return this.entityConstructor.toForm(entity);
  // }

  /**
   * Whether this component currently has a busy overlay showing.
   *
   * Tracked separately from the target because `undefined` is a MEANINGFUL
   * target: `ui.setBusy(undefined)` shows the GLOBAL overlay. Conflating
   * "no target" with "not busy" is what left that overlay stuck — see
   * `handleFormBusyState`.
   */
  private busyShown = false;

  /**
   * The element shown busy by `handleFormBusyState`; `undefined` means the
   * global overlay. Only meaningful while `busyShown` is true.
   */
  private busyTarget: HTMLElement | undefined;

  protected handleFormBusyState(state: RequestState, element?: HTMLElement) {
    const defaultElement = this.formContainer?.nativeElement;
    const target = element ?? defaultElement;

    // Busy iff a request is genuinely in flight. Anything else clears it.
    //
    // This used to test `started` / `completed` / `failed` as three separate
    // ifs, which left a fourth state unhandled: `requestDefault`
    // ({started:false, completed:false, failed:false}) — the value
    // `clearRequestState()` resets to. Components run two effects off the same
    // request: one calling this method, one that reacts to `*Completed()` and
    // immediately calls `clearRequestState()`. When the latter won the race,
    // this method's next run observed the all-false default, matched none of
    // the three branches, and never called `clearBusy()` — so the spinner sat
    // there forever even though the save had succeeded. That is the
    // "spinner never goes away after editing" report, and because it lives in
    // this shared base it affected every form in every app, not just EHR.
    //
    // Treating "not started" as "not busy" makes the handler idempotent and
    // order-independent: whichever effect runs first, the terminal state
    // always clears.
    // Only ever clears a busy state this method actually set, so a form's
    // first render (state = default, nothing in flight) does not fire a
    // stray `clearBusy` at the vendor UI layer, and a `target` that changed
    // between calls still gets released.
    //
    // QA Q6-B28/B29 — the guard used to be `if (this.busyTarget)`, with the
    // target stored as `target ?? null`. A form with no `#formContainer`
    // (the admin User create/edit forms, for instance) resolves `target` to
    // `undefined`, which `ui.setBusy` treats as "show the GLOBAL overlay" —
    // but the very same `undefined` was then recorded as `null`, so the
    // clear branch never ran. The result was a page-blocking overlay that
    // never went away, on BOTH the success and the error path, which is why
    // one duplicate-email save locked the operator out of the whole screen.
    //
    // Tracking "did we set busy" separately from "what did we set it on"
    // keeps the no-stray-clear property while making `undefined` a valid,
    // clearable target.
    if (state.started) {
      this.ui.setBusy(target);
      this.busyShown = true;
      this.busyTarget = target;
      return;
    }

    if (this.busyShown) {
      this.ui.clearBusy(this.busyTarget);
      this.busyShown = false;
      this.busyTarget = undefined;
    }
  }

}
