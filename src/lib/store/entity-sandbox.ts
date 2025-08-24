import { Injector } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { map, Observable } from 'rxjs';
import { RequestCriteria } from '@cartesianui/core';
import { Sandbox, RequestTypes, RequestType } from '@cartesianui/common';

interface EntityConfig<T> {
  selectors: any;
  actions: any;
  model: new (data: any) => T;
}

export class EntitySandbox<T> extends Sandbox {
  entities$: Observable<T[]>;
  meta$: Observable<any>;
  selected$: Observable<T>;
  requestState$: Observable<any>;
  createState$: Observable<any>;
  updateState$: Observable<any>;
  deleteState$: Observable<any>;
  getState$: Observable<any>;

  constructor(
    protected store: Store,
    protected override injector: Injector,
    private config: EntityConfig<T>
  ) {
    super(injector);

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
  }

  fetchAll(criteria: RequestCriteria): void {
    this.store.dispatch(this.config.actions.fetchAll({ criteria }));
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
