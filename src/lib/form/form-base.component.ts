import { Inject, Optional, Component, Injector, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { BaseComponent } from '../base.component';
import { ChildComponent, EntityStatic, ENTITY_CONSTRUCTOR } from '../base.types';
import { IHasForm } from '../base.types';
import { RequestState } from '../store';
@Component({
  template: ''
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
    injector: Injector,
    @Optional() @Inject(ENTITY_CONSTRUCTOR) protected entityConstructor?: EntityStatic<TEntity>
  ) {
    super(injector);
  }

  protected initForm() {
    this.formGroup = this.getFormFromEntity();
  }

  protected getEntityFromForm(formGroup?: FormGroup): TEntity {
    return new this.entityConstructor().fromForm(formGroup ?? this.formGroup);
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

  protected handleFormBusyState(state: RequestState, element?: HTMLElement) {
    const defaultElement = this.formContainer?.nativeElement

    if (state.started) {
      this.ui.setBusy(element ?? defaultElement);
    }
    if (state.completed || state.failed) {
      this.ui.clearBusy(element ?? defaultElement);
    }
  }
}
