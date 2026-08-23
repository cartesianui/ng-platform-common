// shared/utils/entity-feature.util.ts
import { createFeature, createReducer, on, createSelector } from '@ngrx/store';
import { EntityAdapter, createEntityAdapter, Update } from '@ngrx/entity';
import { EntityStateExtended, requestCompleted, requestDefault, requestFailed, requestStarted, updateMetaState } from '@cartesianui/common';

export function entityFeature<T, TStateExtension extends Record<string, any> = {}>(
  featureKey: string,
  actions: any, // action group for the entity (typed loosely here)
  stateExtension?: TStateExtension // optional additional state properties
) {
  const adapter: EntityAdapter<T> = createEntityAdapter<T>();

  interface IFeatureState extends EntityStateExtended<T> {
    selected: T | null;
  }

  type ExtendedFeatureState = IFeatureState & TStateExtension;

  const baseInitialState = {
    selected: null,
    meta: null,
    request: requestDefault,
    get: requestDefault,
    create: requestDefault,
    update: requestDefault,
    delete: requestDefault
  };

  const initialState: any = adapter.getInitialState({
    ...baseInitialState,
    ...(stateExtension || {})
  });

  const reducer = createReducer(
    initialState,

    // -- create
    on(actions.create, (state) => ({
      ...state,
      create: { ...requestStarted }
    })),
    on(actions.createSuccess, (state, { entity }) => ({
      ...state,
      selected: entity,
      create: { ...requestCompleted }
    })),
    on(actions.createFailure, (state) => ({
      ...state,
      create: { ...requestFailed }
    })),

    // -- update
    on(actions.updateSuccess, (state, { entity }) =>
      adapter.updateOne(
        { id: entity.id, changes: entity },
        {
          ...state,
          selected: entity,
          update: { ...requestCompleted }
        }
      )
    ),
    on(actions.updateFailure, (state) => ({
      ...state,
      update: { ...requestFailed }
    })),

    // -- selection
    //
    // `select` is how `getById$` delivers its result (it dispatches
    // `select({ entity })` on success), and `getById` had set `get` to
    // STARTED. Nothing here ever completed it: only `load` — the getAll path —
    // writes `get: completed`. So every `getById` left `get` started forever,
    // and any listing watching `getState()` (all of them) froze its table for
    // good. Invisible while `getById` only ever ran on routed edit pages with
    // no listing on screen; it surfaced the first time something fired it
    // inside an offcanvas flow — the cancel effect's re-fetch after a
    // cancellation is confirmed ("loader stays"). Complete `get` here ONLY if
    // it was started, so a plain `select(entity)` from a listing's Edit button
    // (no request in flight) leaves the request state exactly as it was.
    //
    // The fetched entity is also upserted into the collection when it carries
    // an id, so the listing row shows what the server just said (the document's
    // new `cancelling` status) rather than what it said before the edit.
    // A listing's own `select(entity)` upserts the row it already holds — a
    // no-op.
    on(actions.select, (state, { entity }) => {
      const base = (entity as any)?.id != null ? adapter.upsertOne(entity as any, state) : state;
      return {
        ...base,
        selected: entity,
        get: state.get?.started ? { ...requestCompleted } : state.get
      };
    }),

    // -- CRUD (standard NgRx Entity adapter ops)
    on(actions.add, (state, { entity }) => adapter.addOne(entity, state)),
    on(actions.addMany, (state, { entities }) => adapter.addMany(entities, state)),

    on(actions.upsert, (state, { entity }) => adapter.upsertOne(entity, state)),
    on(actions.upsertMany, (state, { entities }) => adapter.upsertMany(entities, state)),

    //on(actions.update, (state, { entity }) => adapter.updateOne(entity, state)),
    on(actions.update, (state, { entity }) => ({
      ...adapter.updateOne({ id: entity.id, changes: entity }, state),
      update: { ...requestStarted }
    })),
    on(actions.updateMany, (state, { entities }) => adapter.updateMany(entities, state)),

    on(actions.delete, (state) => ({
      ...state,
      delete: { ...requestStarted }
    })),
    on(actions.deleteSuccess, (state, { id }) =>
      adapter.removeOne(id, {
        ...state,
        selected: (state.selected as any)?.id === id ? null : state.selected,
        meta: updateMetaState(state.meta, 'delete'),
        delete: { ...requestCompleted }
      })
    ),
    on(actions.deleteFailure, (state) => ({
      ...state,
      delete: { ...requestFailed }
    })),
    on(actions.deleteMany, (state, { ids }) => adapter.removeMany(ids, state)),

    on(actions.getAll, (state) => ({
      ...state,
      get: { ...requestStarted }
    })),
    on(actions.getById, (state) => ({
      ...state,
      get: { ...requestStarted }
    })),
    on(actions.load, (state, { entities, meta }) =>
      adapter.setAll(entities, {
        ...state,
        meta,
        get: { ...requestCompleted }
      })
    ),
    on(actions.clear, (state) => adapter.removeAll(state)),
    on(actions.getFailure, (state) => ({
      ...state,
      get: { ...requestFailed }
    })),

    // --- Clear specific request states
    on(actions.clearRequest, (state) => ({
      ...state,
      request: { ...requestDefault }
    })),
    on(actions.clearGet, (state) => ({
      ...state,
      get: { ...requestDefault }
    })),
    on(actions.clearCreate, (state) => ({
      ...state,
      create: { ...requestDefault }
    })),
    on(actions.clearUpdate, (state) => ({
      ...state,
      update: { ...requestDefault }
    })),
     on(actions.clearDelete, (state) => ({
      ...state,
      delete: { ...requestDefault }
    })),
    on(actions.clearAllRequests, (state) => ({
      ...state,
      request: { ...requestDefault },
      get: { ...requestDefault },
      create: { ...requestDefault },
      update: { ...requestDefault },
      delete: { ...requestDefault }
    }))
  );

  const feature = createFeature({
    name: featureKey,
    reducer,
    extraSelectors: (selectors) => {
      // Find the generated select<FeatureName>State function dynamically
      const stateSelector = Object.values(selectors)[0] as unknown as (state: any) => IFeatureState;

      return {
        ...adapter.getSelectors(stateSelector),
        meta: createSelector(stateSelector, (state: IFeatureState) => state.meta),
        selected: createSelector(stateSelector, (state: IFeatureState) => state.selected),
        request: createSelector(stateSelector, (state: IFeatureState) => state.request),
        create: createSelector(stateSelector, (state: IFeatureState) => state.create),
        update: createSelector(stateSelector, (state: IFeatureState) => state.update),
        get: createSelector(stateSelector, (state: IFeatureState) => state.get),
        delete: createSelector(stateSelector, (state: IFeatureState) => state.delete),
        entities: createSelector(stateSelector, (state: IFeatureState) => Object.values(state.entities))
      };
    }
  });

  return {
    featureKey,
    reducer: feature.reducer,
    ...feature
  };
}
