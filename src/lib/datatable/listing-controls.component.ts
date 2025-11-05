import { Inject, Optional, AfterViewInit, Component, EventEmitter, Injector, Input, Output, inject, effect } from '@angular/core';
import { ElementRef, ViewChild, runInInjectionContext, DestroyRef } from '@angular/core';
import { RequestCriteria, RequestCriteriaFactory, SearchForm } from '@cartesianui/core';
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
      console.warn('⚠️ No entity constructor provided (creating new).');
      this.entityConstructor = this.getEntityConstructor();
    }

    this.columns = this.entityConstructor.getDataTableCols?.() ?? [];
    this.headers = this.entityConstructor.getDataTableHeaders?.() ?? [];
    this.searchForm = this.entityConstructor.getSearchForm?.() ?? {};
  }

  ngAfterViewInit(): void {
    // Manually trigger once after view init
    // console.log('👀 View initialized — triggering first list()');
    // this.list();
  }

  initCriteria(): RequestCriteria {
    this.criteria = this.criteriaFactory.create(this.searchForm);

    runInInjectionContext(this.injector, () => {
      effect(() => {
        console.log('🔄 Criteria updated →', this.criteria?.queryString?.());
        this.list();
        this.appendSearchCriteriaToUrl();
      });
    });

    return this.criteria;
  }

  setPage(event): void {
    this.criteria.page(this.covertOffsetToPageNumber(event.offset));
  }

  setSorting(event): void {
    this.criteria.orderBy(event.column.name, event.newValue);
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
        if (params['search']) this.criteria.initForm(params['search'] ?? '');
      })
    );
  }

  appendSearchCriteriaToUrl() {
    this._location.replaceState(`${this.router.url.split('?')[0]}${ '?' + this.criteria.queryString()}`);
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
