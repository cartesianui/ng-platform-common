import { Injector, Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store, select } from '@ngrx/store';
import { map, Observable } from 'rxjs';
import { RequestCriteriaOuput } from '@cartesianui/core';
import { Sandbox, RequestTypes, RequestType, RequestState, ResponseMeta, Pagination } from '@cartesianui/common';

interface EntityConfig<T> {
  selectors: any;
  actions: any;
  model: new (data: any) => T;
}

export class EntitySandbox<T> extends Sandbox {

  // Observables (backward compatible)
  entities$: Observable<T[]>;
  meta$: Observable<ResponseMeta>;
  selected$: Observable<T>;
  requestState$: Observable<RequestState>;
  createState$: Observable<RequestState>;
  updateState$: Observable<RequestState>;
  deleteState$: Observable<RequestState>;
  getState$: Observable<RequestState>;

  // Signals (modern Angular)
  readonly entities: Signal<T[]>;
  readonly meta: Signal<ResponseMeta>;
  readonly selected: Signal<T>;
  readonly requestState: Signal<RequestState>;
  readonly createState: Signal<RequestState>;
  readonly updateState: Signal<RequestState>;
  readonly deleteState: Signal<RequestState>;
  readonly getState: Signal<RequestState>;

  // Computed signals (optional convenience)
  readonly hasEntities: Signal<boolean>;
  readonly selectedId: Signal<string>;

  readonly requestCompleted: Signal<boolean>;
  readonly createCompleted: Signal<boolean>;
  readonly updateCompleted: Signal<boolean>;
  readonly deleteCompleted: Signal<boolean>;
  readonly getCompleted: Signal<boolean>;

  readonly requestFailed: Signal<boolean>;
  readonly createFailed: Signal<boolean>;
  readonly updateFailed: Signal<boolean>;
  readonly deleteFailed: Signal<boolean>;
  readonly getFailed: Signal<boolean>;

  readonly pagination: Signal<Pagination>;

  constructor(
    protected store: Store,
    protected override injector: Injector,
    private config: EntityConfig<T>
  ) {
    super();

    const { selectors, model } = this.config;

    this.entities$ = this.store.pipe(
      select(selectors.entities),
      map((entities: any[]) => entities.map((e) => new model(e)))
    );
    this.meta$ = this.store.pipe(select(selectors.meta));
    this.selected$ = this.store.pipe(select(selectors.selected));
    this.requestState$ = this.store.pipe(select(selectors.request));
    this.createState$ = this.store.pipe(select(selectors.create));
    this.updateState$ = this.store.pipe(select(selectors.update));
    this.deleteState$ = this.store.pipe(select(selectors.delete));
    this.getState$ = this.store.pipe(select(selectors.get));

    // Signals (bridged from observables)
    this.entities = toSignal(this.entities$, { initialValue: [] });
    this.meta = toSignal(this.meta$, { initialValue: null });
    this.selected = toSignal(this.selected$, { initialValue: null });
    this.requestState = toSignal(this.requestState$, { initialValue: null });
    this.createState = toSignal(this.createState$, { initialValue: null });
    this.updateState = toSignal(this.updateState$, { initialValue: null });
    this.deleteState = toSignal(this.deleteState$, { initialValue: null });
    this.getState = toSignal(this.getState$, { initialValue: null });

    // Computed convenience signals
    this.hasEntities = computed(() => this.entities().length > 0);
    // this.selectedId = computed(() => this.selected()?.id ?? null);
    this.requestCompleted = computed(() => this.requestState()?.completed ?? false);
    this.createCompleted = computed(() => this.createState()?.completed ?? false);
    this.updateCompleted = computed(() => this.updateState()?.completed ?? false);
    this.deleteCompleted = computed(() => this.deleteState()?.completed ?? false);
    this.getCompleted = computed(() => this.getState()?.completed ?? false);

    this.requestFailed = computed(() => this.requestState()?.failed ?? false);
    this.createFailed = computed(() => this.createState()?.failed ?? false);
    this.updateFailed = computed(() => this.updateState()?.failed ?? false);
    this.deleteFailed = computed(() => this.deleteState()?.failed ?? false);
    this.getFailed = computed(() => this.getState()?.failed ?? false);
    
    this.pagination = computed(() => this.meta()?.pagination ?? null);

    this.pagination = computed(() => this.meta()?.pagination ?? null);
  }

  fetchAll(criteria: RequestCriteriaOuput = null, useExisting: boolean = false): void {
    // Skip if entities already loaded and user wants to use existing
    if (useExisting && this.entities()?.length > 0) {
      return;
    }

    this.store.dispatch(this.config.actions.fetchAll({ criteria }));
  }

  fetchById(id: string): void {
    this.store.dispatch(this.config.actions.fetchById({ id }));
  }

  select(entity: T): void {
    this.store.dispatch(this.config.actions.select({ entity }));
  }

  create(entity: T): void {
    this.store.dispatch(this.config.actions.create({ entity }));
  }

  update(id: string, entity: T): void {
    this.store.dispatch(this.config.actions.update({ entity: { id, changes: entity } }));
  }

  delete(id: string): void {
    this.store.dispatch(this.config.actions.delete({ id }));
  }

  clearRequestState(type: RequestTypes): void {
    switch (type) {
      case RequestType.Get:
        this.store.dispatch(this.config.actions.clearGet());
        break;
      case RequestType.Create:
        this.store.dispatch(this.config.actions.clearCreate());
        break;
      case RequestType.Update:
        this.store.dispatch(this.config.actions.clearUpdate());
        break;
      case RequestType.Delete:
        this.store.dispatch(this.config.actions.clearDelete());
        break;
      case RequestType.Request:
        this.store.dispatch(this.config.actions.clearRequest());
        break;
      case RequestType.All:
        this.store.dispatch(this.config.actions.clearAllRequests());
        break;
      default:
        console.warn(`Unknown request type: ${type}`);
    }
  }
}
