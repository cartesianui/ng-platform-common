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
}
