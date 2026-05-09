import { Component, ContentChild, Input, TemplateRef, Output, EventEmitter, QueryList, ContentChildren, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { RepeatableDirective } from './repeatable.directive';

@Component({
    selector: 'repeatable-form',
    styleUrls: ['./repeatable-from-controls.component.scss'],
    template: `
    <div *ngFor="let item of internalData; let i = index; trackBy: trackByIndex" class="repeatable-row row mb-2 align-items-stretch">
      <div class="col">
        <ng-container *ngTemplateOutlet="template; context: getContext(item, i)"></ng-container>
      </div>

      <div class="repeatable-row__actions col-auto d-flex flex-column justify-content-center gap-2">
        <button *ngIf="showSaveButton" type="button" class="btn btn-success btn-sm repeatable-row__save" (click)="save(i)" title="Save">
          <i class="fa fa-save"></i>
        </button>

        <button type="button" class="btn btn-danger btn-sm repeatable-row__remove" (click)="remove(i)" title="Remove">
          <i class="fa fa-trash"></i>
        </button>
      </div>
    </div>

    <div class="repeatable-add">
      <button type="button" class="btn repeatable-add__btn" (click)="add()">
        <i class="fa fa-plus"></i>
        <span *ngIf="addLabel" class="repeatable-add__label">{{ addLabel }}</span>
      </button>
    </div>

    <ng-content></ng-content>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class RepeatableFormControlsComponent<TDataModel> {
  @Input() data: TDataModel[] = [];

  @Input() showSaveButton: boolean = false;

  /** Optional label for the add button (e.g. "Add item"). Empty = icon only. */
  @Input() addLabel: string = '';

  @Output() dataChange = new EventEmitter<TDataModel[]>();

  @ContentChild(TemplateRef) template: TemplateRef<any>;

  internalData: TDataModel[] = [];

  /**
   * Reference to the last array we emitted via `dataChange`.
   * If the parent assigns this same reference (or a clone of internalData) back
   * into `data`, we skip the resync to avoid an echo-storm that destroys + rebuilds
   * every child row component on every keystroke.
   *
   * Pattern: parent does `this.items = items` inside its `(dataChange)` handler,
   * then synchronously mutates totals on its own form. Change detection runs,
   * `ngOnChanges` fires here with the same array we just emitted. Without this
   * guard we'd reseat every child's `data` input, which triggers each child's
   * effect, which rebuilds each child's form group + valueChanges subscription.
   * Net result: dueling subs on stale form groups → "qty change sometimes
   * updates, sometimes doesn't."
   */
  private lastEmitted: TDataModel[] | null = null;

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
    // Skip echoes of our own emission — the parent re-assigning the array we
    // just emitted is not a real external change.
    if (this.data === this.lastEmitted) {
      return;
    }
    // Keep internalData in sync if parent genuinely replaces `data`.
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
    this.lastEmitted = newData;
    this.dataChange.emit(newData);
  }

  add() {
    const newItem = {} as TDataModel;
    const newData = [...this.internalData, newItem];
    this.internalData = newData;
    this.lastEmitted = newData;
    this.dataChange.emit(newData);
  }

  remove(index: number) {
    const newData = this.internalData.filter((_, i) => i !== index);
    this.internalData = newData;
    this.lastEmitted = newData;
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
