import {
  Component, Input, Output, EventEmitter,
  ContentChildren, ViewChild, QueryList,
  ChangeDetectionStrategy, TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxDatatableModule, DatatableComponent as NgxDatatableComponent } from '@swimlane/ngx-datatable';
import { DatatableColumnDirective } from './datatable-column.directive';
import { FormatterRegistry } from '../models/formatter.registry';

@Component({
  selector: 'app-datatable',
  templateUrl: 'datatable.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, NgxDatatableModule]
})
export class AppDatatableComponent {

  // === Required Inputs ===
  @Input() rows: any[] = [];
  @Input() columns: any[] = [];
  @Input() headers: { name: string; prop?: string }[] = [];
  @Input() count: number = 0;
  @Input() offset: number = 0;
  @Input() limit: number = 30;

  // === Optional Inputs (with defaults) ===
  @Input() selected: any[] = [];
  @Input() tableClass: string = 'material dt-light';
  @Input() columnMode: string = 'force';
  @Input() headerHeight: number = 50;
  @Input() footerHeight: number = 50;
  @Input() rowHeight: number | string = 43;
  @Input() externalPaging: boolean = true;
  @Input() selectionType: string = 'checkbox';
  @Input() sortType: string = 'single';
  @Input() showCheckboxColumn: boolean = true;
  @Input() detailRowHeight: number | string = 'auto';

  // === Outputs ===
  @Output() selectChange = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<any>();
  @Output() sortChange = new EventEmitter<any>();
  @Output() editClick = new EventEmitter<any>();
  @Output() detailToggle = new EventEmitter<any>();

  // === Detail Template (passed as TemplateRef input) ===
  @Input() detailTemplate: TemplateRef<any> | null = null;

  // === Content Projection ===
  @ContentChildren(DatatableColumnDirective) customColumns: QueryList<DatatableColumnDirective>;

  // === NgxDatatable Reference ===
  @ViewChild('dtTable') table: NgxDatatableComponent;

  // === Internal Event Handlers ===

  onSelectInternal(event: any): void {
    this.selectChange.emit(event);
  }

  onPageInternal(event: any): void {
    this.pageChange.emit(event);
  }

  onSortInternal(event: any): void {
    this.sortChange.emit(event);
  }

  onEditInternal(row: any): void {
    this.editClick.emit(row);
  }

  onDetailToggleInternal(event: any): void {
    this.detailToggle.emit(event);
  }

  // === Public Methods ===

  toggleExpandRow(row: any): void {
    this.table?.rowDetail?.toggleExpandRow(row);
  }

  // === Helpers ===

  getCustomTemplate(key: string): TemplateRef<any> | null {
    return this.customColumns?.find(c => c.columnKey === key && !c.columnKey.startsWith('__'))?.templateRef ?? null;
  }

  get extraColumns(): DatatableColumnDirective[] {
    return this.customColumns?.filter(c => c.columnKey.startsWith('__')) ?? [];
  }

  isCustomFormatter(col: any): boolean {
    return !!col?.opt?.formatter?.type && FormatterRegistry.has(col.opt.formatter.type);
  }
}