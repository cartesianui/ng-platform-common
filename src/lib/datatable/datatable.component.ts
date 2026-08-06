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
  // Fires when a `copy`-formatted cell (see FormatterRegistry 'copy') is
  // clicked, after the value has already been written to the clipboard —
  // purely informational, for callers that want to layer a toast on top of
  // the built-in checkmark feedback.
  @Output() copyClick = new EventEmitter<string>();

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

  // A `copy`-formatted cell is plain [innerHTML] (Angular's sanitizer strips
  // any `onclick=` we'd try to bake in), so the actual clipboard write is
  // wired here via delegation: the icon/text the formatter renders carries
  // a `.dt-copy` trigger, and any click inside the cell bubbles up to this
  // listener on the wrapping <span>.
  onCellClick(event: MouseEvent): void {
    this.tryCopyFromEvent(event);
  }

  // The 'link' column variant renders the same [innerHTML] inside a
  // clickable wrapper whose own click opens the edit form — a copy icon can
  // live inside that same cell (e.g. grouped into the Name column's
  // multiline stack), so this checks for the copy trigger FIRST and only
  // falls through to the edit click when the click wasn't on it.
  onLinkCellClick(event: MouseEvent, row: any): void {
    if (this.tryCopyFromEvent(event)) return;
    this.onEditInternal(row);
  }

  /** @returns true if the click was on a copy trigger (and was handled). */
  private tryCopyFromEvent(event: MouseEvent): boolean {
    const trigger = (event.target as HTMLElement)?.closest('.dt-copy') as HTMLElement | null;
    if (!trigger) return false;

    // The full value lives in a plain text node (`.dt-copy-value`), not an
    // attribute — Angular's [innerHTML] sanitizer drops non-allowlisted
    // attributes like `data-copy-value` silently (confirmed live: `class`/
    // `role`/`tabindex`/`title` survive, `data-*` does not), but never
    // touches text content.
    const value = trigger.querySelector('.dt-copy-value')?.textContent?.trim();
    if (!value) return false;

    event.stopPropagation();
    event.preventDefault();
    navigator.clipboard?.writeText(value);
    this.copyClick.emit(value);

    // CSS-only checkmark + "Copied!" bubble (see .dt-copy in
    // _datatable.scss) — no change detection needed, this is a raw DOM node
    // inside innerHTML.
    trigger.classList.add('dt-copy--done');
    window.setTimeout(() => trigger.classList.remove('dt-copy--done'), 1200);
    return true;
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