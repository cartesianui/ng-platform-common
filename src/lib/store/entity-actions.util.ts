// utils/entity-actions.util.ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { IError, RequestCriteriaOuput } from '@cartesianui/core';
import { ResponseMeta } from '@cartesianui/common';

export function entityActions<TModel, TName extends string>(entityName: TName) {
  return createActionGroup({
    source: `${entityName}/API` as any,
    events: {
      'Load': props<{ entities: TModel[]; meta: ResponseMeta }>(),
      'Get All': props<{ criteria: RequestCriteriaOuput }>(),
      'Get By Id': props<{ id: string; includes?: string }>(),

      //quick CRUD actions
      'Add': props<{ entity: TModel }>(),
      'Add Many': props<{ entities: TModel[] }>(),
      'Upsert': props<{ entity: TModel }>(),
      'Upsert Many': props<{ entities: TModel[] }>(),
      'Update': props<{ entity: Update<TModel> }>(),
      'Update Many': props<{ entities: Update<TModel>[] }>(),
      'Delete': props<{ id: string }>(),
      'Delete Many': props<{ ids: string[] }>(),
      'Clear': emptyProps(),
      'Select': props<{ entity: TModel }>(),
      'Create': props<{ entity: TModel }>(),

      // CRUD success/failure actions
      'Load Success': props<{ entities: TModel[]; meta: ResponseMeta }>(),
      'Create Success': props<{ entity: TModel }>(),
      'Create Failure': props<{ errors: IError; message: string }>(),
      'Update Success': props<{ entity: TModel }>(),
      'Update Failure': props<{ errors: IError; message: string }>(),
      'Get Failure': props<{ errors: IError; message: string }>(),

      // Clear specific request states
      'Clear Request': emptyProps(),
      'Clear Get': emptyProps(),
      'Clear Create': emptyProps(),
      'Clear Update': emptyProps(),
      'Clear Delete': emptyProps(),
      'Clear All Requests': emptyProps()
      
    }
  });
}


// Example usage
// import { Product, ProductSearch } from '../models';
// import { entityActions } from '../utils/entity-actions.util';

// export const ProductActions = entityActions<Product, ProductSearch, 'Product'>('Product');

