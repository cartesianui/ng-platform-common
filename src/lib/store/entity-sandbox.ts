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
  /**
   * The server's response body from the last FAILED create, or null (`F61`).
   *
   * For a refusal the operator can answer — read a key off this rather than matching the message
   * text, which is a sentence product people rewrite. See `RequestState.body`.
   */
  readonly createErrorBody: Signal<unknown>;
  /**
   * The field name a refused create says will get it through, or null (`F61`).
   *
   * Lives here rather than in each screen so the rule — *a refusal that names a field can be
   * answered by resending with that field true* — exists ONCE. Five payment create screens read
   * this; copying the `?.confirm` read into each of them is how `F46` happened.
   *
   * Generic on purpose. `confirm` is a property of the RESPONSE, not of payments: any exception
   * that renders the key gets the affordance for free, which is the shape
   * `DuplicatePaymentSuspected` argues for in its own docblock.
   */
  readonly createConfirmField: Signal<string | null>;
  /**
   * The server's message from the last failed create, narrowed to a string, or null (`F61`).
   *
   * Beside `createConfirmField` and for the same reason: `body` is `unknown`, so SOMETHING has to
   * say what it expects of it, and doing that once here beats five components each narrowing the
   * same two keys. `message` is not domain knowledge — it is already a field of the cartesian error
   * shape `extractErrorInfo()` reads and of the `createFailure` payload itself.
   */
  readonly createErrorMessage: Signal<string | null>;
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
    this.selected$ = this.store.pipe(
      select(selectors.selected),
      map((entity: any) => entity && !(entity instanceof model) ? new model(entity) : entity)
    );
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
    // Gated on `failed` so a stale body cannot outlive the failure it came from — the slot is
    // replaced on the next `create`, but a component reading between a retry's start and its
    // result would otherwise still see the old refusal.
    this.createErrorBody = computed(() => (this.createState()?.failed ? this.createState()?.body ?? null : null));
    this.createConfirmField = computed(() => {
      // Narrowed rather than cast. `body` is `unknown`, so this is the one place that says what it
      // expects of it — a `confirm` key holding a non-empty string — and every consumer downstream
      // gets a plain `string | null` instead of having to trust a shape.
      const body = this.createErrorBody();
      if (typeof body !== 'object' || body === null || !('confirm' in body)) {
        return null;
      }
      const field = (body as { confirm?: unknown }).confirm;
      return typeof field === 'string' && field !== '' ? field : null;
    });
    this.createErrorMessage = computed(() => {
      const body = this.createErrorBody();
      if (typeof body !== 'object' || body === null || !('message' in body)) {
        return null;
      }
      const message = (body as { message?: unknown }).message;
      return typeof message === 'string' && message !== '' ? message : null;
    });
    this.updateFailed = computed(() => this.updateState()?.failed ?? false);
    this.deleteFailed = computed(() => this.deleteState()?.failed ?? false);
    this.getFailed = computed(() => this.getState()?.failed ?? false);
    
    this.pagination = computed(() => this.meta()?.pagination ?? null);

    this.pagination = computed(() => this.meta()?.pagination ?? null);
  }

  getAll(criteria: RequestCriteriaOuput = null, useExisting: boolean = false): void {
    // Skip if entities already loaded and user wants to use existing
    if (useExisting && this.entities()?.length > 0) {
      return;
    }

    this.store.dispatch(this.config.actions.getAll({ criteria }));
  }

  /** `includes` is optional — the effect already reads it off the action
   *  (see EntityEffect.getById$) but no caller could reach it until now. */
  getById(id: string, includes?: string): void {
    this.store.dispatch(this.config.actions.getById({ id, includes }));
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
