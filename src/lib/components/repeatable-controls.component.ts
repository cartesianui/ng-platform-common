import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBaseComponent } from './form-base.component';
import { IHasForm } from './base.types';

@Component({
  template: ''
})
export abstract class RepeatableControlsComponent<TEntity extends IHasForm<TEntity>> extends FormBaseComponent<TEntity>{
  @Input() data: TEntity;

  @Input() index: number;

  @Output() dataChange = new EventEmitter<TEntity>();

  protected save(): void {
    //console.log('Saving account-line...');
    //this.dataChange.emit(this.data);
    if (this.formGroup.valid) {
      this.dataChange.emit(this.getEntityFromForm());
    }
  }
}
