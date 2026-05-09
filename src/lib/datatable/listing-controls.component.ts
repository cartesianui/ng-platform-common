import { Inject, Optional, AfterViewInit, Component, EventEmitter, Injector, Input, Output, inject, effect, ChangeDetectorRef, untracked } from '@angular/core';
import { ElementRef, ViewChild, runInInjectionContext, DestroyRef } from '@angular/core';
import { RequestCriteria, RequestCriteriaFactory, SearchForm } from '@cartesianui/core';
import { DateTime } from 'luxon';
import { ExportService, ExportFormat } from '../services/export.service';
import { DatetimeService } from '../services/datetime.service';
import { SearchFieldDescriptor } from '../models/types';
import { BaseComponent } from '../base.component';
import { ChildComponent, EntityStatic, ENTITY_CONSTRUCTOR } from '../base.types';
import { IPaginationModel } from './types';
import { RequestState } from '../store';

@Component({
    template: '',
    providers:[RequestCriteriaFactory],
    standalone: true
})
export abstract class ListingControlsComponent<TDataModel, TChildComponent extends ChildComponent = {}> extends BaseComponent<TChildComponent> implements AfterViewInit {
  @ViewChild('dtContainer', { static: false }) dtContainer: ElementRef;

  protected criteriaFactory = inject(RequestCriteriaFactory);
  protected cdr = inject(ChangeDetectorRef);
  protected exportService = inject(ExportService);

  // use if data is passed from parent
  @Input()
  rows: Array<TDataModel>;

  // Use to populate data directly (in add subscription)
  data: Array<TDataModel>;

  @Input()
  selected: Array<TDataModel> = [];

  // cbClick & selectedChange both save, selected added laterly to use selected & selectedChange conventiobn
  // cbClick not removed to retain backwork compability
  @Output()
  selectedChange: EventEmitter<Array<TDataModel>> = new EventEmitter<Array<TDataModel>>();

  @Output()
  cbClick: EventEmitter<Array<TDataModel>> = new EventEmitter<Array<TDataModel>>();

  columns: { key: string; label: string }[] = [];

  headers: { name: string; prop?: string }[] = [];

  searchForm: SearchForm;

  searchFields: SearchFieldDescriptor[] = [];

  criteria: RequestCriteria;

  pagination: IPaginationModel = {
    currentPage: 1,
    perPage: 30
  };

  searchText = '';

  isTableLoading = false;

  protected entityConstructor?: EntityStatic<TDataModel>

  // @Optional() @Inject(ENTITY_CONSTRUCTOR) protected entityConstructor?: EntityStatic<TDataModel>
  // constructor() {
  //   super();
  //   // this.pagination = ;
  //   // this.loadEntityMetadata();
  // }

  protected getEntityConstructor(): EntityStatic<TDataModel> {
    return this.injector.get(ENTITY_CONSTRUCTOR, null);
  }

  loadEntityMetadata(): void {
    // console.log('loadEntityMetadata called', {
    //   hasEntityConstructor: !!this.entityConstructor,
    //   stack: new Error().stack
    // });

    if (!this.entityConstructor) {
      // console.warn('⚠️ No entity constructor provided (creating new).');
      this.entityConstructor = this.getEntityConstructor();
    }

    this.columns = this.entityConstructor.getDataTableCols?.() ?? [];
    this.headers = this.entityConstructor.getDataTableHeaders?.() ?? [];
    this.searchForm = this.entityConstructor.getSearchForm?.() ?? {};
    this.searchFields = this.entityConstructor.getSearchFields?.() ?? [];
  }

  ngAfterViewInit(): void {
    // Manually trigger once after view init
    // console.log('👀 View initialized — triggering first list()');
    // this.list();
  }

  initCriteria(): RequestCriteria {
    this.criteria = this.criteriaFactory.create(this.searchForm);

    // Hydrate criteria from URL query params synchronously
    const urlParams = new URLSearchParams(this.router.url.split('?')[1] || '');
    const params: Record<string, string> = {};
    urlParams.forEach((v, k) => params[k] = v);
    if (params['search']) {
      this.criteria.hydrateFromUrl(params);
    }

    // Apply field-level defaults before the listing effect registers, so the
    // first list() call already includes them — avoids a double request from
    // a post-init mutation. URL state wins; defaults only fill gaps.
    this.applyFieldDefaults(params);

    runInInjectionContext(this.injector, () => {
      effect(() => {
        // Read queryString signal so Angular tracks it as a dependency
        const qs = this.criteria?.queryString?.();
        // Defer list() to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.list();
          this.appendSearchCriteriaToUrl();
        }, 100);
      }, { allowSignalWrites: true });
    });

    return this.criteria;
  }

  setPage(event): void {
    this.criteria?.page(this.covertOffsetToPageNumber(event.offset));
  }

  setSorting(event): void {
    this.criteria?.orderBy(event.column.name, event.newValue);
  }

  onSelect(event): void {
    this.selected = [...event.selected];
    this.cbClick.emit(this.selected);
    this.selectedChange.emit(this.selected);
  }

  onCreated() {
    this.list();
    this.hideChildComponent(false);
  }

  startLoading(): void {
    // this.ui.setBusy(this.dtContainer.nativeElement);
    // this.isTableLoading = true;
  }

  completeLoading(): void {
    // this.ui.clearBusy();
    // this.isTableLoading = false;
  }

  getCurrentPage(): number {
    return this.pagination?.currentPage ?? 1;
  }

  getOffsetFromPagination(): number {
    return this.covertPageNumberToOffset(this.getCurrentPage());
  }

  covertPageNumberToOffset(pageNumber: number): number {
    return pageNumber - 1;
  }

  covertOffsetToPageNumber(offset: number): number {
    return offset + 1;
  }

  hydrateSearchCriteria(): void {
    this.subscriptions.push(
      this.route.queryParams.subscribe((params) => {
        if (params['search']) {
          this.criteria.hydrateFromUrl(params as Record<string, string>);
        }
      })
    );
  }

  appendSearchCriteriaToUrl() {
    this._location.replaceState(`${this.router.url.split('?')[0]}${ '?' + this.criteria.queryString()}`);
  }

  /**
   * Export current listing data. Pass the API endpoint path.
   * Uses existing criteria (filters, search, sorting) — just adds output format.
   * @example onExport('/products')
   * @example onExport('/products', 'xlsx')
   * @example onExport('/products', 'csv', ['name', 'status', 'barcode'])
   */
  onExport(endpoint: string, format: ExportFormat = 'csv', columns?: string[]): void {
    this.exportService.export(endpoint, this.criteria.httpParams(), format, columns);
  }

  /**
   * Apply per-field `defaultValue` from `searchFields` to the criteria. Skips
   * any field already populated by URL hydration so deep links override
   * defaults. Runs synchronously; the listing's queryString-watching effect
   * will pick up the mutated criteria as part of its initial read, so the
   * defaulted slice arrives in a single GET.
   *
   * Date sentinels (`'today'` / `'thisWeek'` / etc.) resolve at call time.
   */
  private applyFieldDefaults(urlParams: Record<string, string>): void {
    const hydratedColumns = this.collectHydratedColumns(urlParams);
    for (const field of this.searchFields) {
      if (field.defaultValue == null) continue;
      if (hydratedColumns.has(field.key)) continue;

      if (field.type === 'date') {
        const dt = this.resolveDateSentinel(field.defaultValue);
        if (!dt) continue;
        this.criteria.where(field.key, field.operator || '=', DatetimeService.toIsoDate(dt));
      } else if (field.type === 'daterange') {
        const range = this.resolveDateRangeSentinel(field.defaultValue);
        if (!range) continue;
        this.criteria.whereBetween(field.key, [DatetimeService.toIsoDate(range[0]), DatetimeService.toIsoDate(range[1])]);
      } else {
        this.criteria.where(field.key, field.operator || '=', field.defaultValue);
      }
    }
  }

  private collectHydratedColumns(urlParams: Record<string, string>): Set<string> {
    const cols = new Set<string>();
    if (!urlParams['search']) return cols;
    const wheres = (this.criteria as any)?.wheres?.() ?? [];
    for (const w of wheres) cols.add(w.column);
    return cols;
  }

  private resolveDateSentinel(input: any): DateTime | null {
    if (input instanceof Date) return DatetimeService.fromJSDate(input).startOf('day');
    const sentinel = DatetimeService.resolveSentinel(input);
    if (sentinel) return sentinel;
    if (typeof input === 'string') {
      const dt = DateTime.fromISO(input);
      return dt.isValid ? dt.startOf('day') : null;
    }
    return null;
  }

  private resolveDateRangeSentinel(input: any): [DateTime, DateTime] | null {
    if (Array.isArray(input) && input.length === 2) {
      const start = this.resolveDateSentinel(input[0]);
      const end   = this.resolveDateSentinel(input[1]);
      if (start && end) return [start, end];
      return null;
    }
    if (typeof input === 'string') {
      switch (input) {
        case 'thisWeek':  return [DatetimeService.startOfThisWeek(), DatetimeService.endOfThisWeek()];
        case 'lastWeek':  return [DatetimeService.startOfLastWeek(), DatetimeService.endOfLastWeek()];
        case 'thisMonth': return [DatetimeService.startOfThisMonth(), DatetimeService.endOfThisMonth()];
        case 'lastMonth': return [DatetimeService.startOfLastMonth(), DatetimeService.endOfLastMonth()];
      }
    }
    return null;
  }

  protected abstract list(): void;

  protected handleBusyState(state: RequestState, element?: HTMLElement) {
    const defaultElement = this.dtContainer?.nativeElement;
    const target = element ?? defaultElement;

    if(!target)
      return;

    // console.log('⚙️ [BusyState] Handling state:', state.status, '→', state);

    if (state.started) {
      // console.log('🚀 Request started — setting busy state on:', target);
      this.ui.setBusy(target);
    }

    if (state.completed) {
      // console.log('✅ Request completed — clearing busy state on:', target);
      this.ui.clearBusy(target);
    }

    if (state.failed) {
      // console.log('❌ Request failed — clearing busy state on:', target);
      this.ui.clearBusy(target);
    }
  }
}
