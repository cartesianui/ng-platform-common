import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { RequestCriteria } from '@cartesianui/core';
import { SearchFieldDescriptor } from '../../models/types';
import { SelectableControlComponent } from '../../form/control/selectable-control.component';
import { DatetimeService } from '../../services';

@Component({
  selector: 'search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, BsDatepickerModule, SelectableControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-panel-wrapper" *ngIf="visibleFields.length || searchKey">
      <!-- Quick search + filter toggle row (always visible) -->
      <div class="d-flex align-items-center gap-2">
        <!-- Quick search -->
        <div *ngIf="searchKey" class="input-group input-group-sm" style="max-width: 280px">
          <span class="input-group-text bg-white border-end-0">
            <i class="fas fa-search text-muted"></i>
          </span>
          <input
            type="text"
            class="form-control border-start-0"
            [placeholder]="searchPlaceholder"
            [(ngModel)]="quickSearchText"
            (keyup.enter)="onQuickSearch()"
            (input)="onQuickSearchInput()"
          />
        </div>

        <!-- Filter toggle -->
        <div
          *ngIf="visibleFields.length"
          class="search-panel-toggle d-flex align-items-center ms-auto"
          (click)="togglePanel()"
        >
          <i class="fa fa-sliders-h me-1"></i>
          <span>Filters</span>
          <span *ngIf="activeFilterCount" class="badge bg-primary ms-1">{{ activeFilterCount }}</span>
          <i class="fa ms-1" [class.fa-chevron-down]="!expanded" [class.fa-chevron-up]="expanded"></i>
        </div>
      </div>

      <!-- Advanced filters (collapsible) -->
      <div class="search-panel-body" [class.show]="expanded" *ngIf="visibleFields.length">
        <div class="row g-2 pt-2">
          <ng-container *ngFor="let field of visibleFields">
            <div [class]="'col-md-' + (field.width || '3')">

              <!-- Text input -->
              <ng-container *ngIf="!field.type || field.type === 'text'">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onTextModel(field, $event)"
                />
              </ng-container>

              <!-- Number input -->
              <ng-container *ngIf="field.type === 'number'">
                <input
                  type="number"
                  class="form-control form-control-sm"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onTextModel(field, $event)"
                />
              </ng-container>

              <!-- Select dropdown -->
              <ng-container *ngIf="field.type === 'select'">
                <select
                  class="form-select form-select-sm"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onSelectModel(field, $event)"
                >
                  <option value="">{{ field.placeholder || field.label || readableName(field.key) }}</option>
                  <option *ngFor="let opt of field.options" [value]="opt.value">{{ opt.label || opt.name }}</option>
                </select>
              </ng-container>

              <!-- Entity lookup (selectable-control) -->
              <ng-container *ngIf="field.type === 'entity'">
                <selectable-control
                  [url]="field.url"
                  [optionField]="field.optionField || 'name'"
                  [optionKey]="field.optionKey || 'id'"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || null"
                  (ngModelChange)="onEntityChange(field, $event)"
                ></selectable-control>
              </ng-container>

              <!-- Date picker (bsDatepicker) -->
              <ng-container *ngIf="field.type === 'date'">
                <input
                  bsDatepicker
                  class="form-control form-control-sm"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [bsValue]="fieldDateValues[field.key] || null"
                  (bsValueChange)="onDateChange(field, $event)"
                />
              </ng-container>

              <!-- Date range picker (bsDaterangepicker) -->
              <ng-container *ngIf="field.type === 'daterange'">
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-white">
                    <i class="fas fa-calendar-alt text-muted"></i>
                  </span>
                  <input
                    bsDaterangepicker
                    class="form-control"
                    [placeholder]="field.placeholder || field.label || readableName(field.key)"
                    [bsValue]="fieldDateRangeValues[field.key] || null"
                    (bsValueChange)="onDateRangePickerChange(field, $event)"
                  />
                </div>
              </ng-container>

              <!-- Boolean -->
              <ng-container *ngIf="field.type === 'boolean'">
                <select
                  class="form-select form-select-sm"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onSelectModel(field, $event)"
                >
                  <option value="">{{ field.placeholder || field.label || readableName(field.key) }}</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </ng-container>

            </div>
          </ng-container>

          <!-- Clear all button -->
          <div class="col-auto d-flex align-items-end" *ngIf="activeFilterCount">
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="clearAll()">
              <i class="fa fa-times me-1"></i>Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-panel-wrapper {
      border: 1px solid #e0e0e0;
      border-radius: 0.375rem 0.375rem 0 0;
      border-bottom: none;
      background: #fafbfc;
      padding: 0.5rem 0.75rem;
    }

    .search-panel-toggle {
      cursor: pointer;
      user-select: none;
      font-size: 0.8rem;
      color: #6c757d;
      transition: color 0.15s ease;
    }

    .search-panel-toggle:hover {
      color: #343a40;
    }

    .search-panel-toggle .badge {
      font-size: 0.65rem;
      vertical-align: middle;
    }

    .search-panel-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s ease, padding 0.25s ease;
      border-top: 0 solid transparent;
    }

    .search-panel-body.show {
      max-height: 300px;
      overflow: visible;
      padding-top: 0.5rem;
      border-top: 1px solid #e9ecef;
      margin-top: 0.5rem;
    }

    /* Quick search input */
    .search-panel-wrapper .input-group .form-control:focus {
      box-shadow: none;
      border-color: #86b7fe;
    }

    /* Match selectable-control height to form-control-sm */
    :host ::ng-deep selectable-control .lookup-input-wrapper {
      min-height: 31px !important;
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem !important;
      background: #fff;
    }

    :host ::ng-deep selectable-control .lookup-input-wrapper input {
      font-size: 0.875rem;
    }

    :host ::ng-deep selectable-control .lookup-input-wrapper .badge {
      font-size: 0.75rem;
    }

    /* Clear button */
    .btn-outline-secondary {
      font-size: 0.78rem;
      padding: 0.2rem 0.5rem;
    }
  `]
})
export class SearchPanelComponent implements OnInit, OnDestroy {
  @Input() fields: SearchFieldDescriptor[] = [];
  @Input() criteria!: RequestCriteria;
  @Input() expanded = false;

  /** Quick search: field key to search on (e.g. 'name'). If set, shows the quick search bar. */
  @Input() searchKey: string | null = null;

  /** Quick search: operator to use (default: 'like') */
  @Input() searchOperator: string = 'like';

  /** Quick search: placeholder text */
  @Input() searchPlaceholder: string = 'Search...';

  private cdr = inject(ChangeDetectorRef);

  visibleFields: SearchFieldDescriptor[] = [];
  activeFilterCount = 0;
  quickSearchText = '';

  // Current values for each field (for template binding)
  fieldValues: Record<string, any> = {};

  // Date values as JS Date objects (for bsDatepicker binding)
  fieldDateValues: Record<string, Date | null> = {};

  // Date range values as [Date, Date] (for bsDaterangepicker binding)
  fieldDateRangeValues: Record<string, [Date, Date] | null> = {};

  // Debounce for text inputs
  private textSubject = new Subject<{ field: SearchFieldDescriptor; value: string | null }>();
  private quickSearchSubject = new Subject<string | null>();
  private subs: Subscription[] = [];

  // Track active filters
  private activeFilters = new Set<string>();

  ngOnInit(): void {
    this.visibleFields = this.fields.filter(f => !f.hidden);

    // Debounce text inputs by 400ms
    this.subs.push(
      this.textSubject.pipe(debounceTime(400)).subscribe(({ field, value }) => {
        this.applyFilter(field, value);
      })
    );

    // Debounce quick search by 400ms
    this.subs.push(
      this.quickSearchSubject.pipe(debounceTime(400)).subscribe((value) => {
        if (this.searchKey) {
          this.criteria.page(1);
          this.criteria.where(this.searchKey, this.searchOperator, value);
        }
      })
    );

    // Hydrate from existing criteria wheres (e.g. from URL)
    this.hydrateFromCriteria();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Read current wheres from criteria and populate field values.
   * Auto-expands panel if filters are present.
   */
  private hydrateFromCriteria(): void {
    const wheres = this.criteria?.wheres?.() || [];
    if (!wheres.length) return;

    for (const where of wheres) {
      // Check if this is the quick search field
      if (this.searchKey && where.column === this.searchKey) {
        this.quickSearchText = String(where.value || '');
        continue;
      }

      const field = this.fields.find(f => f.key === where.column);
      if (!field) continue;

      if (field.type === 'daterange' && where.operator === 'between' && typeof where.value === 'string') {
        const [startStr, endStr] = where.value.split(',');
        if (startStr && endStr) {
          this.fieldDateRangeValues[field.key] = [new Date(startStr), new Date(endStr)];
        }
      } else if (field.type === 'date' && typeof where.value === 'string') {
        this.fieldDateValues[field.key] = new Date(where.value);
      } else {
        this.fieldValues[field.key] = where.value;
      }

      this.activeFilters.add(field.key);
    }

    this.activeFilterCount = this.activeFilters.size;

    // Auto-expand if there are active filters (not counting quick search)
    if (this.activeFilterCount > 0) {
      this.expanded = true;
    }

    this.cdr.markForCheck();
  }

  togglePanel(): void {
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
  }

  // --- Quick search ---

  onQuickSearch(): void {
    if (this.searchKey) {
      this.criteria.page(1);
      this.criteria.where(this.searchKey, this.searchOperator, this.quickSearchText?.trim() || null);
    }
  }

  onQuickSearchInput(): void {
    this.quickSearchSubject.next(this.quickSearchText?.trim() || null);
  }

  // --- Advanced filter handlers ---

  onTextModel(field: SearchFieldDescriptor, value: string): void {
    const trimmed = value?.trim() || null;
    this.fieldValues[field.key] = trimmed;
    this.textSubject.next({ field, value: trimmed });
  }

  onSelectModel(field: SearchFieldDescriptor, value: string): void {
    this.fieldValues[field.key] = value || null;
    this.applyFilter(field, value || null);
  }

  onEntityChange(field: SearchFieldDescriptor, value: any): void {
    this.fieldValues[field.key] = value || null;
    this.applyFilter(field, value || null);
  }

  onDateChange(field: SearchFieldDescriptor, date: Date): void {
    if (date) {
      this.fieldDateValues[field.key] = date;
      const apiDate = DatetimeService.fromJSDate(date).toISODate(); // YYYY-MM-DD
      this.applyFilter(field, apiDate);
    } else {
      this.fieldDateValues[field.key] = null;
      this.applyFilter(field, null);
    }
  }

  onDateRangePickerChange(field: SearchFieldDescriptor, dates: [Date, Date]): void {
    if (dates && dates[0] && dates[1]) {
      this.fieldDateRangeValues[field.key] = dates;
      const start = DatetimeService.fromJSDate(dates[0]).toISODate(); // YYYY-MM-DD
      const end = DatetimeService.fromJSDate(dates[1]).toISODate();   // YYYY-MM-DD
      this.trackFilter(field.key, true);
      this.criteria.page(1);
      this.criteria.whereBetween(field.key, [start, end]);
    } else {
      this.fieldDateRangeValues[field.key] = null;
      this.trackFilter(field.key, false);
      this.criteria.page(1);
      this.criteria.where(field.key, null);
    }
  }

  clearAll(): void {
    for (const key of this.activeFilters) {
      this.criteria.where(key, null);
    }
    // Clear quick search
    if (this.searchKey) {
      this.quickSearchText = '';
      this.criteria.where(this.searchKey, null);
    }
    this.activeFilters.clear();
    this.activeFilterCount = 0;
    this.fieldValues = {};
    this.fieldDateValues = {};
    this.fieldDateRangeValues = {};
    this.criteria.page(1);
    this.cdr.markForCheck();
  }

  readableName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .replace(/Id$/, '')
      .trim();
  }

  private applyFilter(field: SearchFieldDescriptor, value: any): void {
    this.trackFilter(field.key, value != null && value !== '');
    this.criteria.page(1);
    this.criteria.where(field.key, field.operator || '=', value);
  }

  private trackFilter(key: string, active: boolean): void {
    if (active) {
      this.activeFilters.add(key);
    } else {
      this.activeFilters.delete(key);
    }
    this.activeFilterCount = this.activeFilters.size;
    this.cdr.markForCheck();
  }
}
