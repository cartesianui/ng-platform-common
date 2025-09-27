import { Component, ContentChild, Input, TemplateRef, Output, EventEmitter, QueryList, ContentChildren, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { RepeatableDirective } from './repeatable.directive';

@Component({
    selector: 'repeatable-form',
    template: `
    <div class="mb-3 d-flex justify-content-end">
      <button type="button" class="btn btn-primary btn-sm" (click)="add()">
        <i class="fa fa-plus"></i>
      </button>
    </div>
    <div *ngFor="let item of internalData; let i = index; trackBy: trackByIndex" class="row mb-2 align-items-stretch">
      <div class="col">
        <ng-container *ngTemplateOutlet="template; context: getContext(item, i)"></ng-container>
      </div>

      <div class="col-auto d-flex flex-column justify-content-center gap-2">
        <button *ngIf="showSaveButton" type="button" class="btn btn-success btn-sm" (click)="save(i)" title="Save">
          <i class="fa fa-save"></i>
        </button>

        <button type="button" class="btn btn-danger btn-sm" (click)="remove(i)" title="Remove">
          <i class="fa fa-trash"></i>
        </button>
      </div>
    </div>

    <ng-content></ng-content>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class RepeatableFormControlsComponent<TDataModel> {
  @Input() data: TDataModel[] = [];

  @Input() showSaveButton: boolean = false;

  @Output() dataChange = new EventEmitter<TDataModel[]>();

  @ContentChild(TemplateRef) template: TemplateRef<any>;

  internalData: TDataModel[] = [];

  @ContentChildren(RepeatableDirective, { descendants: true }) itemDirectives!: QueryList<RepeatableDirective>;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterContentInit() {
    this.itemDirectives.forEach((dir, idx) => {
      // Assign the component instance manually
      const element = dir as any;
      if (element) {
        dir.componentInstance = element;
        dir.index = idx;
      }
    });
  }

  ngOnInit() {
    this.internalData = [...this.data];
  }

  ngOnChanges() {
    // Keep internalData in sync if parent replaces `data`
    this.internalData = [...this.data];
  }

  getContext(item: TDataModel, index: number) {
    return {
      $implicit: item,
      index,
      onChange: this.updateItemAtIndex.bind(this, index)
    };
  }

  trackByIndex(index: number, item: TDataModel): number {
    return index;
    // return (item as any).id;
  }

  updateItemAtIndex(index: number, value: any): void {
    this.updateItem(value, index); // call your existing logic
  }

  updateItem(value: TDataModel, index: number) {
    // Immutable replacement
    const newData = this.internalData.map((item, i) => (i === index ? value : item));
    this.internalData = newData;
    this.dataChange.emit(newData);
  }

  add() {
    const newItem = {} as TDataModel;
    const newData = [...this.internalData, newItem];
    this.internalData = newData;
    this.dataChange.emit(newData);
  }

  remove(index: number) {
    const newData = this.internalData.filter((_, i) => i !== index);
    this.internalData = newData;
    this.dataChange.emit(newData);
  }

  // ⚠️ NOTE:
  // this.itemDirectives is a QueryList (content projection).
  // Its order is based on the DOM, not strictly tied to your `internalData` array.
  // When items are added/removed/re-rendered, Angular may re-create elements,
  // so the QueryList order can shift.
  //
  // That means `toArray()[index]` may not point to the same logical item
  // as `internalData[index]`, even though the console shows the correct index.
  // This explains why sometimes "index=1" still triggers the first item.
  //
  // ✅ Fixes:
  // - Use `trackBy` in *ngFor to stabilize DOM reuse, OR
  // - Store a stable identifier (e.g. item.id) and map directives by that.

  // ✅ Used: used first way added trackByIndex to solve the order problem
  save(index: number) {
    const directive = this.itemDirectives?.toArray()[index];
    if (directive?.componentInstance?.save) {
      directive.componentInstance.save();
    } else {
      console.warn('Save method not found on component at index', index);
    }
  }
}
