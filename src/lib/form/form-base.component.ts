import { Inject, Optional, Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { BaseComponent } from '../base.component';
import { ChildComponent, EntityStatic, ENTITY_CONSTRUCTOR } from '../base.types';
import { IHasForm } from '../base.types';
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
    const defaultElement = this.formContainer?.nativeElement;
    const target = element ?? defaultElement;

    // console.log('⚙️ [BusyState] Handling state:', state.status, '→', state);

    if (state.started) {
      console.log('🚀 Request started — setting busy state on:', target);
      this.ui.setBusy(target);
    }

    if (state.completed) {
      console.log('✅ Request completed — clearing busy state on:', target);
      this.ui.clearBusy(target);
    }

    if (state.failed) {
      console.log('❌ Request failed — clearing busy state on:', target);
      this.ui.clearBusy(target);
    }
  }

}
