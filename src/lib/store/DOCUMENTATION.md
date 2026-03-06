# Store Module

NgRx-based state management for CartesianUI. Provides factory utilities and a sandbox class that standardize CRUD operations for all entities.

## File Structure

```
store/
  entity-actions.util.ts    # Factory: creates typed NgRx action group for an entity
  entity-feature.util.ts    # Factory: creates NgRx feature (reducer + selectors)
  entity-effect.ts          # Abstract base class for HTTP-backed effects
  entity-sandbox.ts         # EntitySandbox — reactive wrapper (Observables + Signals)
  state.types.ts            # Types: RequestState, Pagination, ResponseMeta, EntityStateExtended
  loader.model.ts           # (Deprecated) Old loader state interfaces
  index.ts                  # Barrel exports
```

## Architecture

```
Component
  └── injects Sandbox (e.g. CatalogSandbox)
        └── has EntitySandbox<Product> per entity
              ├── dispatches Actions → Store
              ├── reads Selectors → Signals / Observables
              └── EntityEffect handles side effects (HTTP)

Data Flow:
  Component → EntitySandbox.getAll() → dispatches getAll action
    → EntityEffect.getAll$ → HttpService.getAll()
    → success: dispatches load({ entities, meta })
    → Reducer updates state
    → Selectors provide data to Signals
    → Component reads sb.product.entities()
```

---

## Setting Up a New Entity Store

Every entity needs three files: actions, reducer (feature), and effects. The factory utilities generate all the boilerplate.

### 1. Actions

```typescript
// store/product/actions.ts
import { entityActions } from '@cartesianui/common';
import { Product } from '../../models';

const actions = entityActions<Product, 'Product'>('Product');
export const ProductActions = { ...actions };
```

This generates a full action group with source `[Product/API]` containing: `getAll`, `getById`, `load`, `create`, `createSuccess`, `createFailure`, `update`, `updateSuccess`, `updateFailure`, `delete`, `select`, `clear`, and all state-clearing actions.

### 2. Reducer (Feature)

```typescript
// store/product/reducer.ts
import { entityFeature } from '@cartesianui/common';
import { Product } from '../../models';
import { ProductActions } from './actions';

export const fromProduct = entityFeature<Product>('products', ProductActions);
```

This creates a complete NgRx feature with:
- Entity adapter (normalized state)
- Reducer handling all CRUD actions
- Selectors for entities, meta, selected, and per-operation request states

### 3. Effects

```typescript
// store/product/effect.ts
import { Injectable } from '@angular/core';
import { EntityEffect } from '@cartesianui/common';
import { Product } from '../../models';
import { ProductActions } from './actions';
import { ProductHttpService } from '../../shared';

@Injectable()
export class ProductEffects extends EntityEffect<Product> {
  constructor(httpService: ProductHttpService) {
    super(httpService, ProductActions);
  }
}
```

The base class provides effects for: `getAll$`, `getById$`, `create$`, `update$`, `delete$`. Override individual effects for custom behavior.

### 4. Wire Up in Providers

```typescript
// catalog.providers.ts
import { fromProduct } from './store/product/reducer';
import { ProductEffects } from './store/product/effect';

export function provideCatalogFeature(): EnvironmentProviders {
  return makeEnvironmentProviders([
    importProvidersFrom(
      StoreModule.forFeature(fromProduct.featureKey, fromProduct.reducer),
      EffectsModule.forFeature([ProductEffects]),
    ),
    // Shared Services
    ProductHttpService,
  ]);
}
```

---

## EntitySandbox

Reactive wrapper that provides both RxJS Observables and Angular Signals for reading store state, and methods for dispatching CRUD actions.

### Creating in a Sandbox

```typescript
@Injectable()
export class CatalogSandbox extends Sandbox {
  private store = inject(Store);

  product = new EntitySandbox<Product>(this.store, this.injector, {
    selectors: fromProduct,       // Feature from entityFeature()
    actions: ProductActions,      // Actions from entityActions()
    model: Product                // Model class constructor
  });

  category = new EntitySandbox<Category>(this.store, this.injector, {
    selectors: fromCategory,
    actions: CategoryActions,
    model: Category
  });
}
```

### Methods

| Method | Description |
|--------|-------------|
| `getAll(criteria?, useExisting?)` | Fetch all entities. Skips if `useExisting=true` and data exists |
| `getById(id)` | Fetch single entity by ID, sets as selected |
| `select(entity)` | Set entity as selected |
| `create(entity)` | Dispatch create action |
| `update(id, entity)` | Dispatch update action (wraps in `{ id, changes }`) |
| `delete(id)` | Dispatch delete action |
| `clearRequestState(type)` | Clear request state for a specific operation |

### Signal Properties

| Signal | Type | Description |
|--------|------|-------------|
| `entities` | `Signal<T[]>` | All entities |
| `selected` | `Signal<T>` | Currently selected entity |
| `pagination` | `Signal<Pagination>` | Pagination from metadata |
| `hasEntities` | `Signal<boolean>` | True if entities exist |

### Request State Signals

Each operation has `completed` and `failed` computed signals:

| Signal | Description |
|--------|-------------|
| `requestCompleted` / `requestFailed` | List fetch state |
| `createCompleted` / `createFailed` | Create operation state |
| `updateCompleted` / `updateFailed` | Update operation state |
| `deleteCompleted` / `deleteFailed` | Delete operation state |
| `getCompleted` / `getFailed` | Get-by-ID state |

### Observable Properties (Backward Compatible)

All signal properties have a matching `$` Observable counterpart: `entities$`, `selected$`, `meta$`, `requestState$`, `createState$`, `updateState$`, `deleteState$`, `getState$`.

### Clearing Request State

```typescript
import { RequestType } from '@cartesianui/common';

// Clear specific operation
this.sb.product.clearRequestState(RequestType.Create);

// Clear all
this.sb.product.clearRequestState(RequestType.All);
```

---

## Usage in Components

### Listing Page

```typescript
export class ProductListingComponent extends ListingControlsComponent<IProduct> {
  sb = inject(CatalogSandbox);

  ngOnInit(): void {
    this.loadEntityMetadata();
    this.initCriteria();
  }

  protected list(): void {
    this.sb.product.getAll(this.criteria.httpParams());
  }
}
```

### Create Page

```typescript
export class ProductCreateComponent extends FormBaseComponent<Product> {
  sb = inject(CatalogSandbox);

  private readonly createEffect = effect(() => {
    if (this.sb.product.createCompleted()) {
      // Navigate away or show success
    }
    if (this.sb.product.createFailed()) {
      // Show error
    }
  });

  onSave(): void {
    const entity = this.getEntityFromForm();
    this.sb.product.create(entity);
  }
}
```

### Edit Page

```typescript
export class ProductEditComponent extends FormBaseComponent<Product> {
  sb = inject(CatalogSandbox);

  private readonly selectEffect = effect(() => {
    const selected = this.sb.product.selected();
    if (!selected) return;
    this.formGroup.patchValue(this.getFormFromEntity(selected).value);
  });

  onSave(): void {
    const entity = this.getEntityFromForm();
    this.sb.product.update(this.sb.product.selected()?.id, entity);
  }
}
```

---

## Types

### RequestState

Tracks the lifecycle of an async operation:

```typescript
type RequestState = {
  started: boolean;
  completed: boolean;
  failed: boolean;
};
```

Predefined constants: `requestDefault`, `requestStarted`, `requestCompleted`, `requestFailed`.

### RequestType

```typescript
enum RequestType {
  Get = 'get',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Request = 'request',
  All = 'all'
}
```

### Pagination

```typescript
type Pagination = {
  total: number;
  count: number;
  perPage: number;
  currentPage: number;
  totalPages: number;
  links: Object;
};
```

### ResponseMeta

```typescript
type ResponseMeta = {
  pagination: Pagination;
} & { [key: string]: any };
```

### EntityStateExtended

The NgRx state shape for each entity feature:

```typescript
interface EntityStateExtended<T> extends NgRxEntityState<T> {
  meta: ResponseMeta | null;
  request: RequestState | undefined;
  get: RequestState | undefined;
  create: RequestState | undefined;
  update: RequestState | undefined;
  delete: RequestState | undefined;
}
```

---

## Entity Actions Reference

`entityActions<T>(name)` generates the following action group:

| Action | Payload | Triggered By |
|--------|---------|-------------|
| `getAll` | `{ criteria }` | `EntitySandbox.getAll()` |
| `getById` | `{ id }` | `EntitySandbox.getById()` |
| `load` | `{ entities, meta }` | Effect on fetch success |
| `select` | `{ entity }` | `EntitySandbox.select()` or effect |
| `create` | `{ entity }` | `EntitySandbox.create()` |
| `createSuccess` | `{ entity }` | Effect on create success |
| `createFailure` | `{ errors, message }` | Effect on create failure |
| `update` | `{ entity: { id, changes } }` | `EntitySandbox.update()` |
| `updateSuccess` | `{ entity }` | Effect on update success |
| `updateFailure` | `{ errors, message }` | Effect on update failure |
| `delete` | `{ id }` | `EntitySandbox.delete()` |
| `add` | `{ entity }` | Direct dispatch |
| `addMany` | `{ entities }` | Direct dispatch |
| `clear` | — | Direct dispatch |
| `clearRequest` | — | `clearRequestState(RequestType.Request)` |
| `clearGet` | — | `clearRequestState(RequestType.Get)` |
| `clearCreate` | — | `clearRequestState(RequestType.Create)` |
| `clearUpdate` | — | `clearRequestState(RequestType.Update)` |
| `clearDelete` | — | `clearRequestState(RequestType.Delete)` |
| `clearAllRequests` | — | `clearRequestState(RequestType.All)` |

## EntityEffect Base Class

Abstract class providing standard NgRx effects for CRUD operations. All effects use `asyncScheduler` to prevent `ExpressionChangedAfterItHasBeenCheckedError`.

| Effect | Listens To | Calls | Dispatches On Success | Dispatches On Failure |
|--------|-----------|-------|-----------------------|----------------------|
| `getAll$` | `getAll` | `httpService.getAll()` | `load({ entities, meta })` | `getFailure()` |
| `getById$` | `getById` | `httpService.getById()` | `select({ entity })` | `getFailure()` |
| `create$` | `create` | `httpService.create()` | `createSuccess({ entity })` | `createFailure()` |
| `update$` | `update` | `httpService.update()` | `updateSuccess({ entity })` | `updateFailure()` |
| `delete$` | `delete` | `httpService.delete()` | — | — |

Override any effect in your subclass for custom behavior.

---

## Extending the Entity Store

When an entity needs operations beyond standard CRUD (e.g. `getActiveShifts`, `endShift`, `checkout`), extend each layer following a consistent pattern. All five layers must be extended together.

### Extension Flow

```
HTTP Service (custom methods)
  → Actions (additionalActions)
    → Reducer (wrapper reducer + custom selectors)
      → Effects (custom createEffect)
        → Sandbox (custom dispatch methods)
```

---

### 1. HTTP Service — Add Custom Methods

Define an extension type with the custom method signatures, then implement them in the service.

```typescript
// shared/shift/http.service.ts
import { Observable } from 'rxjs';
import { IHttpService, HttpService, GET, PATCH, Path, DefaultHeaders, ICartesianResponse } from '@cartesianui/core';
import { Shift } from '../../models';

// Extension type — declares custom methods
export type IShiftHttpServiceExtension = {
  getActiveShifts: (id: string) => Observable<ICartesianResponse>;
  endShift: (id: string) => Observable<ICartesianResponse>;
};

@Injectable()
@DefaultHeaders({
  Accept: 'application/json',
  'Content-Type': 'application/json'
})
export class ShiftHttpService extends HttpService implements IHttpService<Shift, IShiftHttpServiceExtension> {

  // Standard CRUD methods (getAll, getById, create, update, delete)
  // ...

  // Extension methods
  @GET('/employees/{id}/active-shifts')
  public getActiveShifts(@Path('id') id: string): Observable<any> {
    return null;
  }

  @PATCH('/shifts/{id}/end')
  public endShift(@Path('id') id: string): Observable<any> {
    return null;
  }
}
```

**Convention:** Always define `IXxxHttpServiceExtension` as a `type`, even when empty:

```typescript
// No custom methods yet — empty extension
export type IProductHttpServiceExtension = {};

export class ProductHttpService extends HttpService implements IHttpService<Product, IProductHttpServiceExtension> {
  // Standard CRUD only
}
```

---

### 2. Actions — Add Custom Actions

Spread the base actions with `additionalActions` containing custom action triplets (action / success / failure).

```typescript
// store/shift/actions.ts
import { createAction, props } from '@ngrx/store';
import { entityActions } from '@cartesianui/common';
import { Shift } from '../../models';

const actions = entityActions<Shift, 'Shift'>('Shift');

export const additionalActions = {
  fetchActiveShifts: createAction('[Shift] Fetch Active Shift', props<{ id: string }>()),
  fetchActiveShiftsSuccess: createAction('[Shift] Fetch Active Shift Success', props<{ entity: Shift }>()),
  fetchActiveShiftsFailure: createAction('[Shift] Fetch Active Shift Failure', props<{ message: string; errors?: any }>()),
  endShift: createAction('[Shift] End Shift', props<{ id: string }>()),
  endShiftSuccess: createAction('[Shift] End Shift Success', props<{ entity: Shift }>()),
  endShiftFailure: createAction('[Shift] End Shift Failure', props<{ message: string; errors?: any }>()),
};

// Merge base + custom
export const ShiftActions = {
  ...actions,
  ...additionalActions,
};
```

**Convention:** Custom actions follow triplet pattern: `actionName` / `actionNameSuccess` / `actionNameFailure`. The source prefix uses `[EntityName]` (e.g. `[Shift]`).

When no custom actions are needed, export the spread without additionalActions:

```typescript
export const ProductActions = { ...actions };
```

---

### 3. Reducer — Wrapper Reducer + Custom Selectors

Wrap the base reducer to handle custom actions. Use spread to replace the reducer while keeping all base selectors.

```typescript
// store/shift/reducer.ts
import { entityFeature } from '@cartesianui/common';
import { Shift } from '../../models';
import { ShiftActions } from './actions';

const baseFeature = entityFeature<Shift>('shifts', ShiftActions);

// Wrap reducer to handle custom actions
const originalReducer = baseFeature.reducer;
const customReducer = (state: any, action: any) => {
  let newState = originalReducer(state, action);
  if (action.type === ShiftActions.endShiftSuccess.type) {
    return { ...newState, selected: null };  // Clear selected after ending shift
  }
  return newState;
};

export const fromShift = { ...baseFeature, reducer: customReducer };
```

**Key pattern:** `{ ...baseFeature, reducer: customReducer }` — replaces only the reducer, all selectors from `entityFeature` are preserved.

**Custom selectors** (when needed):

```typescript
import { createSelector } from '@ngrx/store';

export const selectActiveShifts = createSelector(
  fromShift.selectAll,
  (entities: Shift[]) => entities.filter((e) => e.active)
);

export const selectActiveShiftCount = createSelector(
  selectActiveShifts,
  (active) => active.length
);
```

When no custom reducer logic is needed, export directly:

```typescript
export const fromProduct = entityFeature<Product>('products', ProductActions);
```

---

### 4. Effects — Custom createEffect

Add custom effects as class properties. Pass the HTTP extension type as the second generic parameter.

```typescript
// store/shift/effect.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, EMPTY } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { EntityEffect } from '@cartesianui/common';
import { ShiftActions } from './actions';
import { Shift } from '../../models';
import { IShiftHttpServiceExtension, ShiftHttpService } from '../../shared';

@Injectable()
export class ShiftEffects extends EntityEffect<Shift, IShiftHttpServiceExtension> {
  constructor(actions$: Actions, httpService: ShiftHttpService) {
    super(httpService, ShiftActions);
  }

  // Custom effect — fetch active shifts for an employee
  fetchActiveShifts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShiftActions.fetchActiveShifts),
      map((action: any) => action.id),
      switchMap((id) =>
        this.httpService.getActiveShifts(id).pipe(
          switchMap(({ data }) => data ? of(ShiftActions.select({ entity: data })) : EMPTY),
          catchError(({ message, errors }) =>
            of(ShiftActions.fetchActiveShiftsFailure({ message, errors }))
          )
        )
      )
    )
  );

  // Custom effect — end a shift
  endShift$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShiftActions.endShift),
      map((action: any) => action.id),
      switchMap((id) =>
        this.httpService.endShift(id).pipe(
          map(({ data }) => ShiftActions.endShiftSuccess({ entity: data })),
          catchError(({ message, errors }) =>
            of(ShiftActions.endShiftFailure({ message, errors }))
          )
        )
      )
    )
  );
}
```

**Key patterns:**
- `EntityEffect<Shift, IShiftHttpServiceExtension>` — second generic enables `this.httpService.getActiveShifts()` etc.
- Without extension: `EntityEffect<Product>` (single type param)
- Custom effects follow the same `ofType → switchMap → httpService → map/catchError` structure as base effects
- Override base effects by declaring a property with the same name (e.g. `getAll$`)

---

### 5. Sandbox — Custom Dispatch Methods

Add methods on the sandbox class that dispatch custom actions.

```typescript
// shift.sandbox.ts
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Sandbox, EntitySandbox } from '@cartesianui/common';
import { fromShift, ShiftActions } from './store';
import { Shift } from './models';

@Injectable()
export class ShiftSandbox extends Sandbox {
  private store = inject(Store);

  shift = new EntitySandbox<Shift>(this.store, this.injector, {
    selectors: fromShift,
    actions: ShiftActions,
    model: Shift,
  });

  // Custom dispatch methods
  getActiveShifts(employeeId: string): void {
    this.store.dispatch(ShiftActions.fetchActiveShifts({ id: employeeId }));
  }

  endShift(shiftId: string): void {
    this.store.dispatch(ShiftActions.endShift({ id: shiftId }));
  }
}
```

**Convention:**
- Standard CRUD: `sb.shift.getAll()`, `sb.shift.create(entity)`, `sb.shift.selected()`
- Custom ops: `sb.getActiveShifts(id)`, `sb.endShift(id)`

---

### Extension Checklist

When adding a custom operation to an entity, touch all five files:

| # | File | What to Add |
|---|------|-------------|
| 1 | `shared/http.service.ts` | Method signature in `IXxxHttpServiceExtension` + decorated method |
| 2 | `store/xxx/actions.ts` | Action triplet in `additionalActions` |
| 3 | `store/xxx/reducer.ts` | Wrap reducer if custom state changes needed |
| 4 | `store/xxx/effect.ts` | `createEffect()` wiring action → HTTP → success/failure |
| 5 | `xxx.sandbox.ts` | `dispatch()` method for components to call |

---

### Extending Entity State

When custom operations need their own request tracking or additional state properties beyond standard CRUD, extend the entity state using the `entityFeature()` third parameter.

#### Base State (What You Start With)

Every entity store created by `entityFeature()` has this state shape out of the box:

```typescript
interface EntityStateExtended<T> extends NgRxEntityState<T> {
  // NgRxEntityState provides: ids[], entities{}
  meta: ResponseMeta | null;       // Pagination info from API
  selected: T | null;              // Currently selected entity
  request: RequestState | undefined;  // getAll state (started/completed/failed)
  get: RequestState | undefined;      // getById state
  create: RequestState | undefined;   // create state
  update: RequestState | undefined;   // update state
  delete: RequestState | undefined;   // delete state
}
```

This covers standard CRUD. When you need **additional properties** — a separate request tracker, a "current" entity, or a secondary entity collection — extend this state.

#### Pattern

1. Define a state extension interface
2. Create initial values object
3. Pass as third arg to `entityFeature<T, IExtension>()`
4. Handle custom actions in the wrapper reducer
5. Create custom selectors for the new state properties
6. Export selectors alongside the feature

#### Simple Example — Custom Request State

When a custom operation needs its own loading/success/error tracking (separate from the base `request` state):

```typescript
// store/visit/reducer.ts
import { entityFeature, requestStarted, requestCompleted, requestFailed, RequestState, requestDefault } from '@cartesianui/common';
import { createSelector } from '@ngrx/store';
import { Visit } from '../../models';
import { VisitActions } from './actions';

// 1. Define extension interface
export interface IVisitStateExtended {
  getOpenVisitsRequest: RequestState | undefined;
}

// 2. Create initial values
const stateExtension: IVisitStateExtended = {
  getOpenVisitsRequest: requestDefault
};

// 3. Pass as third arg — entityFeature<T, IExtension>(key, actions, extension)
const baseFeature = entityFeature<Visit, IVisitStateExtended>('visits', VisitActions, stateExtension);

// 4. Wrap reducer to handle custom actions
const originalReducer = baseFeature.reducer;
const customReducer = (state: any, action: any) => {
  let newState = originalReducer(state, action);
  switch (action.type) {
    case VisitActions.getPatientOpenVisitForDoctor.type:
      return { ...newState, getOpenVisitsRequest: { ...requestStarted } };
    case VisitActions.getPatientOpenVisitForDoctorSuccess.type:
      return { ...newState, getOpenVisitsRequest: { ...requestCompleted } };
    case VisitActions.getPatientOpenVisitForDoctorFailure.type:
      return { ...newState, getOpenVisitsRequest: { ...requestFailed } };
    default:
      return newState;
  }
};

// 5. Create custom selectors
const stateSelector = (baseFeature as any).selectVisitsState;
const getOpenVisitsRequest = createSelector(stateSelector, (state: any) => state.getOpenVisitsRequest);

// 6. Export feature with custom reducer and selectors
export const fromVisit = { ...baseFeature, reducer: customReducer, getOpenVisitsRequest };
```

#### Complex Example — Custom Entity Collection + Derived Selectors

When a custom operation stores data in a separate collection (not the main entity adapter):

```typescript
// store/cash-drawer/reducer.ts
export interface ICashDrawerStateExtended {
  currentDrawerRequest: RequestState | undefined;
  currentDrawer: CashDrawer | null;
}

const stateExtension: ICashDrawerStateExtended = {
  currentDrawerRequest: requestDefault,
  currentDrawer: null
};

const baseFeature = entityFeature<CashDrawer, ICashDrawerStateExtended>(
  'cashDrawers', CashDrawerActions, stateExtension
);

const originalReducer = baseFeature.reducer;
const customReducer = (state: any, action: any) => {
  let newState = originalReducer(state, action);
  switch (action.type) {
    case CashDrawerActions.fetchCurrentDrawer.type:
      return { ...newState, currentDrawerRequest: { ...requestStarted } };
    case CashDrawerActions.fetchCurrentDrawerSuccess.type:
      return {
        ...newState,
        currentDrawer: action.entity,
        currentDrawerRequest: { ...requestCompleted }
      };
    case CashDrawerActions.fetchCurrentDrawerFailure.type:
      return { ...newState, currentDrawer: null, currentDrawerRequest: { ...requestFailed } };
    case CashDrawerActions.clearCurrentDrawer.type:
      return { ...newState, currentDrawer: null };
    default:
      return newState;
  }
};

const stateSelector = (baseFeature as any).selectCashDrawersState;
const currentDrawerRequest = createSelector(stateSelector, (state: any) => state.currentDrawerRequest);
const currentDrawer = createSelector(stateSelector, (state: any) => state.currentDrawer);

export const fromCashDrawer = {
  ...baseFeature,
  reducer: customReducer,
  currentDrawerRequest,
  currentDrawer
};
```

#### Using Extended State in Sandbox

Custom selectors are consumed via `this.store.select()` or `toSignal()`:

```typescript
@Injectable()
export class DrawerSandbox extends Sandbox {
  private store = inject(Store);

  drawer = new EntitySandbox<CashDrawer>(this.store, this.injector, {
    selectors: fromCashDrawer,
    actions: CashDrawerActions,
    model: CashDrawer,
  });

  // Custom signal from extended state selector
  currentDrawer = toSignal(this.store.select(fromCashDrawer.currentDrawer));
  currentDrawerRequest = toSignal(this.store.select(fromCashDrawer.currentDrawerRequest));

  getCurrentDrawer(): void {
    this.store.dispatch(CashDrawerActions.fetchCurrentDrawer());
  }

  clearCurrentDrawer(): void {
    this.store.dispatch(CashDrawerActions.clearCurrentDrawer());
  }
}
```

#### When to Extend State

| Scenario | Approach |
|----------|----------|
| Custom operation needs loading/error tracking | Add `RequestState` property |
| Need a "current" or "active" entity separate from `selected` | Add typed property (e.g. `currentDrawer: CashDrawer \| null`) |
| Need a separate entity collection (e.g. "my items" vs "all items") | Add array property (e.g. `entitiesAssignedToMe: T[]`) |
| Need derived computed data from custom state | Add `createSelector()` chains |

#### Real-World Examples

| Entity | Extended State | Purpose |
|--------|---------------|---------|
| pos/cart | `fetchMyCartsRequest` | Track "my carts" fetch independently from "all carts" |
| pos/drawer | `currentDrawer`, `currentDrawerRequest` | Active drawer separate from list of all drawers |
| care/visit | `getOpenVisitsRequest` | Track "open visits for doctor" fetch state |
| care/queue | `assignedToMeRequest`, `entitiesAssignedToMe` | Separate "my queue" from "all queue", with role-based selectors |
