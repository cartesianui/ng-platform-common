import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormBaseComponent } from '../form-base.component';
import { IHasForm } from '../../base.types';

@Component({
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export abstract class RepeatableFormBaseComponent<TEntity extends IHasForm<TEntity>> extends FormBaseComponent<TEntity>{
  @Input() data: TEntity;

  @Input() index: number;

  @Output() dataChange = new EventEmitter<TEntity>();

  protected emitChange() {
    if (this.dataChange && this.formGroup.valid) {
      this.dataChange.emit(this.getEntityFromForm() as TEntity);
    }
  }

  protected save(): void {
    if (this.formGroup.valid) {
      this.dataChange.emit(this.getEntityFromForm() as TEntity);
    }
  }
}
