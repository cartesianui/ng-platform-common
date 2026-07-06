import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { RequestCriteria } from '@cartesianui/core';
import { SearchFieldDescriptor } from '../../models/types';
import { SelectableControlComponent } from '../../form/control/selectable-control.component';
import { SelectControlComponent } from '../../form/control/select-control.component';
import { DatetimeService } from '../../services';

@Component({
  selector: 'search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, BsDatepickerModule, SelectableControlComponent, SelectControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-panel-wrapper" *ngIf="visibleFields.length || searchKey">
      <!-- Quick search + filter toggle row (always visible) -->
      <div class="d-flex align-items-center gap-2">
        <!-- Quick search — single rounded pill: icon + borderless input -->
        <label *ngIf="searchKey" class="sp-search">
          <i class="fas fa-search"></i>
          <input
            type="text"
            [placeholder]="searchPlaceholder"
            [(ngModel)]="quickSearchText"
            (keyup.enter)="onQuickSearch()"
            (input)="onQuickSearchInput()"
          />
        </label>

        <!-- Filter toggle — outlined button -->
        <button
          *ngIf="visibleFields.length"
          type="button"
          class="sp-filters-btn ms-auto"
          (click)="togglePanel()"
        >
          <i class="fa fa-filter"></i>
          <span>Filters</span>
          <span *ngIf="activeFilterCount" class="sp-filters-count">{{ activeFilterCount }}</span>
          <i class="fa sp-filters-caret" [class.fa-chevron-down]="!expanded" [class.fa-chevron-up]="expanded"></i>
        </button>
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
                  class="form-control"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onTextModel(field, $event)"
                />
              </ng-container>

              <!-- Number input -->
              <ng-container *ngIf="field.type === 'number'">
                <input
                  type="number"
                  class="form-control"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || ''"
                  (ngModelChange)="onTextModel(field, $event)"
                />
              </ng-container>

              <!-- Select dropdown -->
              <!-- Static-option (enum) filter — rendered via the lightweight
                   themed select-control instead of a native <select> so the
                   option list matches the app palette (native <option> lists
                   are OS-rendered and can't be themed). Opens the full list on
                   click, so it still behaves like a select. -->
              <ng-container *ngIf="field.type === 'select'">
                <select-control
                  [options]="field.options || []"
                  optionKey="value"
                  [optionField]="field.optionField || 'name'"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [ngModel]="fieldValues[field.key] || null"
                  (ngModelChange)="onSelectModel(field, $event)"
                ></select-control>
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
                  class="form-control"
                  [placeholder]="field.placeholder || field.label || readableName(field.key)"
                  [bsValue]="fieldDateValues[field.key] || null"
                  (bsValueChange)="onDateChange(field, $event)"
                />
              </ng-container>

              <!-- Date range picker (bsDaterangepicker) -->
              <ng-container *ngIf="field.type === 'daterange'">
                <div class="input-group">
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
                  class="form-select"
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
        </div>

        <!-- Clear filters — own row, auto-width (sized to content), left-aligned -->
        <div class="sp-clear-row" *ngIf="activeFilterCount">
          <button type="button" class="sp-clear-btn" (click)="clearAll()">
            <i class="fa fa-times"></i>Clear filters
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-panel-wrapper {
      border: 1px solid var(--cui-border-color);
      border-radius: var(--cui-border-radius-lg) var(--cui-border-radius-lg) 0 0;
      /* divider between the filter area and the table header (mockup) */
      border-bottom: 1px solid var(--cui-border-color);
      background: var(--cui-secondary-bg);
      padding: 0.75rem 1rem;
    }

    /* Quick search pill (mockup) — icon + borderless input on white surface */
    .sp-search {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      flex: 1;
      max-width: 430px;
      margin: 0;
      padding: 0.625rem 0.85rem;
      background: var(--ct-surface);
      border: 1px solid var(--cui-border-color);
      border-radius: var(--cui-border-radius);
      color: var(--cui-tertiary-color);
    }
    .sp-search i {
      font-size: 0.85rem;
    }
    .sp-search input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      outline: none;
      font: inherit;
      font-size: 0.85rem;
      color: var(--cui-body-color);
    }
    .sp-search input::placeholder {
      color: var(--cui-tertiary-color);
    }
    .sp-search:focus-within {
      border-color: var(--cui-primary);
    }

    /* Filters toggle (mockup) — outlined button + primary count badge */
    .sp-filters-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.8rem;
      border: 1px solid var(--cui-border-color);
      border-radius: var(--cui-border-radius);
      background: var(--ct-surface);
      color: var(--cui-secondary-color);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.12s ease, color 0.12s ease;
    }
    .sp-filters-btn:hover {
      border-color: var(--cui-primary);
      color: var(--cui-body-color);
    }
    .sp-filters-count {
      display: inline-flex;
      align-items: center;
      background: var(--cui-primary);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.05rem 0.45rem;
      border-radius: var(--cui-border-radius-sm);
    }
    .sp-filters-caret {
      font-size: 0.7rem;
      opacity: 0.7;
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
      border-top: 1px solid var(--cui-border-color);
      margin-top: 0.5rem;
    }

    /* Quick search input */
    .search-panel-wrapper .input-group .form-control:focus {
      box-shadow: none;
      border-color: var(--cui-primary);
    }

    /* selectable-control in filters uses the global input size (no -sm
       override) so it stays consistent with the other filter inputs. */
    :host ::ng-deep selectable-control .lookup-input-wrapper .badge {
      font-size: 0.75rem;
    }

    /* Clear filters — own row, compact auto-width outlined button (mockup) */
    .sp-clear-row {
      margin-top: 0.7rem;
    }
    .sp-clear-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      width: auto;
      border: 1px solid var(--cui-border-color);
      border-radius: var(--cui-border-radius);
      background: transparent;
      color: var(--cui-secondary-color);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.4rem 0.7rem;
      cursor: pointer;
    }
    .sp-clear-btn:hover {
      background: var(--cui-tertiary-bg);
      color: var(--cui-body-color);
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

    // Hydrate from existing criteria wheres (e.g. URL state, defaults seeded
    // by the listing's `applyFieldDefaults` before its first list() fired).
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
