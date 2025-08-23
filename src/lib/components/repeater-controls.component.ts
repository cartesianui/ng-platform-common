import { Component, ContentChild, Input, TemplateRef, Output, EventEmitter, QueryList, ContentChildren } from '@angular/core';
import { RepeaterItemDirective } from './repeater-item.directive';

@Component({
  selector: 'app-repeater',
  template: `
    <div class="mb-3 d-flex justify-content-end">
      <button type="button" class="btn btn-primary btn-sm" (click)="add()">
        <i class="fa fa-plus"></i>
      </button>
    </div>
    <div *ngFor="let item of internalData; let i = index" class="row align-items-start mb-2">
      <div class="col">
        <ng-container *ngTemplateOutlet="template; context: getContext(item, i)"></ng-container>
      </div>

      <div class="col-auto d-flex flex-column gap-1">
        <button type="button" class="btn btn-success btn-sm" (click)="save(i)" title="Save">
          <i class="fa fa-save"></i>
        </button>

        <button type="button" class="btn btn-danger btn-sm" (click)="remove(i)" title="Remove">
          <i class="fa fa-trash"></i>
        </button>
      </div>
    </div>

    <ng-content></ng-content>
  `
})
export class RepeaterControlsComponent<TDataModel> {

  @Input() data: TDataModel[] = [];

  @Output() dataChange = new EventEmitter<TDataModel[]>();

  @ContentChild(TemplateRef) template: TemplateRef<any>;

  internalData: TDataModel[] = [];

  @ContentChildren(RepeaterItemDirective, { descendants: true }) itemDirectives!: QueryList<RepeaterItemDirective>;
  
  //   @ViewChildren('container', { read: ViewContainerRef }) containers!: QueryList<ViewContainerRef>;
  //   private collectedOutputs: TOutput[] = [];
  //   ngAfterViewInit(): void {
  //     this.containers.forEach((container, index) => {
  //       const compRef: ComponentRef<any> = container.createComponent(this.component);
  //       compRef.instance.input = this.inputs[index]; // assume child has an `@Input() input`

  //       // Subscribe to the output
  //       compRef.instance.output?.subscribe((value: TOutput) => {
  //         this.collectedOutputs[index] = value;
  //         this.outputs.emit(this.collectedOutputs); // emit aggregated values
  //       });
  //     });
  //   }

  ngAfterContentInit() {
    this.itemDirectives.forEach((dir, idx) => {
      // Assign the component instance manually
      const element = (dir as any);
      if (element) {
        dir.componentInstance = element;
        dir.index = idx;
      }
    });
  }

  ngOnInit() {
    this.internalData = [...this.data];
  }

  getContext(item: TDataModel, index: number) {
    return {
      $implicit: item,
      index,
      onChange: this.updateItemAtIndex.bind(this, index)
    };
  }

  updateItemAtIndex(index: number, value: any): void {
    this.updateItem(value, index); // call your existing logic
  }

  updateItem(value: TDataModel, index: number) {
    this.internalData[index] = value;
    this.dataChange.emit(this.internalData);
  }

  add() {
    const newItem = {} as TDataModel; // Create an empty item (customize this)
    this.internalData.push(newItem);
    this.dataChange.emit(this.internalData);
  }

  remove(index: number) {
    this.internalData.splice(index, 1);
    this.dataChange.emit(this.internalData);
  }

  
  save(index: number) {
    const directive = this.itemDirectives?.toArray()[index];
    if (directive?.componentInstance?.save) {
      directive.componentInstance.save();
    } else {
      console.warn('Save method not found on component at index', index);
    }
  }

}
