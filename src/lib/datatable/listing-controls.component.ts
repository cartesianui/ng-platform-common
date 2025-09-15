import { Inject, Optional, AfterViewInit, Component, EventEmitter, Injector, Input, Output } from '@angular/core';
import { ElementRef, ViewChild } from '@angular/core';
import { RequestCriteria, SearchForm } from '@cartesianui/core';
import { BaseComponent } from '../base.component';
import { ChildComponent, EntityStatic, ENTITY_CONSTRUCTOR } from '../base.types';
import { IPaginationModel } from './types';
import { RequestState } from '../store';

@Component({
  template: ''
})
export abstract class ListingControlsComponent<TDataModel, TChildComponent extends ChildComponent = {}> extends BaseComponent<TChildComponent> implements AfterViewInit {
  @ViewChild('dtContainer', { static: false }) dtContainer: ElementRef;

  // use if data is passed from parent
  @Input()
  rows: Array<TDataModel>;

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

  // Use to populate data directly (in add subscription)
  data: Array<TDataModel>;

  criteria: RequestCriteria; //RequestCriteria;  // force initializer

  pagination: IPaginationModel;

  searchText = '';

  isTableLoading = false;

  constructor(
    protected injector: Injector,
    @Optional() @Inject(ENTITY_CONSTRUCTOR) protected entityConstructor?: EntityStatic<TDataModel>
  ) {
    super(injector);
    this.pagination = {
      currentPage: 1,
      perPage: 30
    };
    //this.loadEntityMetadata();
  }

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
    this.list();
  }

  // initCriteria(searchForm: { new (): TSearchFormModel }): RequestCriteria<TSearchFormModel> {
  //   return (this.criteria = new RequestCriteria<TSearchFormModel>(new searchForm()));
  // }

  initCriteria(): RequestCriteria {
    return (this.criteria = new RequestCriteria(this.searchForm));
  }


  setPage(event): void {
    this.criteria.page(this.covertOffsetToPageNumber(event.offset));
    this.list();
  }

  setSorting(event): void {
    this.criteria.orderBy(event.column.name, event.newValue);
    this.list();
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
        if (params['search']) this.criteria.urlParamsToSearchCriteria(params['search'] ?? '');
      })
    );
  }

  appendSearchCriteriaToUrl() {
    this._location.replaceState(`${this.router.url.split('?')[0]}${this.criteria.searchCriteriaToUrlParams()}`);
  }

  protected abstract list(): void;

  protected handleBusyState(state: RequestState, element?: HTMLElement) {
    const defaultElement = this.dtContainer?.nativeElement;

    if (state.started) {
      this.ui.setBusy(element ?? defaultElement);
    }
    if (state.completed || state.failed) {
      this.ui.clearBusy(element ?? defaultElement);
    }
  }
}
