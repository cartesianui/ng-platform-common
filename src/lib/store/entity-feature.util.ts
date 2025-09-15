// shared/utils/entity-feature.util.ts
import { createFeature, createReducer, on, createSelector } from '@ngrx/store';
import { EntityAdapter, createEntityAdapter, Update } from '@ngrx/entity';
import { EntityStateExtended, requestCompleted, requestDefault, requestFailed, requestStarted, updateMetaState } from '@cartesianui/common';

export function entityFeature<T>(
  featureKey: string,
  actions: any // action group for the entity (typed loosely here)
) {
  const adapter: EntityAdapter<T> = createEntityAdapter<T>();

  interface IFeatureState extends EntityStateExtended<T> {
    selected: T | null;
  }

  const initialState: IFeatureState = adapter.getInitialState({
    selected: null,
    meta: null,
    request: requestDefault,
    get: requestDefault,
    create: requestDefault,
    update: requestDefault,
    delete: requestDefault
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
    on(actions.select, (state, { entity }) => ({
      ...state,
      selected: entity
    })),

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

    on(actions.delete, (state, { id }) =>
      adapter.removeOne(id, {
        ...state,
        meta: updateMetaState(state.meta, 'delete')
      })
    ),
    on(actions.deleteMany, (state, { ids }) => adapter.removeMany(ids, state)),

    on(actions.fetchAll, (state) => ({
      ...state,
      get: { ...requestStarted }
    })),
    on(actions.fetchById, (state) => ({
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
    on(actions.fetchFailure, (state) => ({
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
