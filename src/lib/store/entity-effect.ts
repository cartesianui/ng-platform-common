import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, EMPTY, asyncScheduler } from 'rxjs';
import { map, switchMap, catchError, observeOn } from 'rxjs/operators';
import { Update,  } from '@ngrx/entity';
import { ICartesianResponse, IHttpService, IHttpServiceExtension, RequestCriteriaOuput } from '@cartesianui/core';
import { entityActions } from './entity-actions.util';

/**
 * Helper function to extract error information from various error formats
 */
function extractErrorInfo(error: any): { message: string; errors: any } {
  // Handle Cartesian API response format
  if (error?.errors || error?.message) {
    return {
      message: error.message || 'An error occurred',
      errors: error.errors || error
    };
  }

  // Handle HTTP error response
  if (error?.error) {
    return extractErrorInfo(error.error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      errors: { name: error.name, stack: error.stack }
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      errors: error
    };
  }

  // Fallback
  return {
    message: 'An unknown error occurred',
    errors: error
  };
}

export abstract class EntityEffect<TModel, THttpServiceExtension extends IHttpServiceExtension = {}> {
  protected actions$ = inject(Actions);

  /**
   * Override this to customize the entity name for logging
   * By default, it extracts from the action type
   */
  protected get entityName(): string {
    const actionType = this.actions?.getAll?.type || '';
    const match = actionType.match(/\[(.*?)\]/);
    return match ? match[1] : 'Entity';
  }

  constructor(
    protected httpService: IHttpService<TModel, THttpServiceExtension>,
    protected actions: ReturnType<typeof entityActions<TModel, any>> // typed action creators
  ) {
    if (!httpService) {
      console.error(`[EntityEffect] HTTP service is undefined for ${this.entityName}`);
    }
    if (!actions) {
      console.error(`[EntityEffect] Actions are undefined for ${this.entityName}`);
    }
  }

  /**
   * Log error with context
   */
  protected logError(operation: string, context: any, error: any): void {
    console.error(`[${this.entityName}] ${operation} failed:`, {
      context,
      error: extractErrorInfo(error)
    });
  }

  getAll$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.getAll),
      map((action: any) => action.criteria),
      switchMap((criteria: RequestCriteriaOuput) =>
        this.httpService.getAll(criteria).pipe(
          map(({ data, meta }: ICartesianResponse) => {
            if (!data) {
              console.warn(`[${this.entityName}] getAll returned no data`);
            }
            return this.actions.load({ entities: data || [], meta });
          }),
          catchError((error) => {
            const { message, errors } = extractErrorInfo(error);
            this.logError('getAll', { criteria }, error);
            return of(this.actions.getFailure({ errors, message }));
          })
        )
      ),
      // Schedule state updates asynchronously to prevent ExpressionChangedAfterItHasBeenCheckedError
      observeOn(asyncScheduler)
    )
  });


  getById$ = this.httpService.getById
    ? createEffect(() => this.actions$.pipe(
        ofType(this.actions.getById),
        map((action: any) => action.id),
        switchMap((id: string) =>
          this.httpService.getById!(id).pipe(
            map(({ data }: ICartesianResponse) => {
              if (!data) {
                console.warn(`[${this.entityName}] getById returned no data for id: ${id}`);
              }
              return this.actions.select({ entity: data });
            }),
            catchError((error) => {
              const { message, errors } = extractErrorInfo(error);
              this.logError('getById', { id }, error);
              return of(this.actions.getFailure({ errors, message }));
            })
          )
        ),
        // Schedule state updates asynchronously to prevent ExpressionChangedAfterItHasBeenCheckedError
        observeOn(asyncScheduler)
      )
    )
    : () => EMPTY;

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.create),
      map((action: any) => action.entity),
      switchMap((entity: TModel) =>
        this.httpService.create(entity).pipe(
          map(({ data }: ICartesianResponse) => {
            if (!data) {
              throw new Error('No data returned from create operation');
            }
            return this.actions.createSuccess({ entity: data });
          }),
          catchError((error) => {
            const { message, errors } = extractErrorInfo(error);
            this.logError('create', { entity }, error);
            return of(this.actions.createFailure({ errors, message }));
          })
        )
      ),
      // Schedule state updates asynchronously to prevent ExpressionChangedAfterItHasBeenCheckedError
      observeOn(asyncScheduler)
    )
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.update),
      map((action: any) => action.entity),
      switchMap(({ id, changes }: Update<TModel>) =>
        this.httpService.update(id as string, changes).pipe(
          map(({ data }: ICartesianResponse) => {
            if (!data) {
              throw new Error('No data returned from update operation');
            }
            return this.actions.updateSuccess({ entity: data });
          }),
          catchError((error) => {
            const { message, errors } = extractErrorInfo(error);
            this.logError('update', { id, changes }, error);
            return of(this.actions.updateFailure({ errors, message }));
          })
        )
      ),
      // Schedule state updates asynchronously to prevent ExpressionChangedAfterItHasBeenCheckedError
      observeOn(asyncScheduler)
    )
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.delete),
      map((action: any) => action.id),
      switchMap((id: string) =>
        this.httpService.delete(id).pipe(
          map(() => {
            console.log(`[${this.entityName}] Successfully deleted entity with id: ${id}`);
            return { type: '[Noop] Delete Success' };
          }),
          catchError((error) => {
            this.logError('delete', { id }, error);
            return EMPTY; // Or dispatch a delete failure action if needed
          })
        )
      ),
      // Schedule state updates asynchronously to prevent ExpressionChangedAfterItHasBeenCheckedError
      observeOn(asyncScheduler)
    )
  );

  // // Optional: selectEntity effect if you want to trigger something on selection
  // selectEntity$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(this.actions.selectEntity),
  //     map((action: any) => {
  //       console.log('Entity selected:', action.entity);
  //       return { type: '[Noop] Select Handled' };
  //     })
  //   ),
  //   { dispatch: false }
  // );

  // // Optional: upsert
  // upsertEntity$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(this.actions.upsertEntity),
  //     map((action: any) => action.entity),
  //     switchMap((entity: TModel) => {
  //       if (entity.id) {
  //         return this.httpService.update(entity.id, entity).pipe(
  //           map(({ data }: ICartesianResponse) =>
  //             this.actions.updateSuccess({ entity: data })
  //           ),
  //           catchError(({ errors, message }: ICartesianResponse) =>
  //             of(this.actions.updateFailure({ errors, message }))
  //           )
  //         );
  //       } else {
  //         return this.httpService.create(entity).pipe(
  //           map(({ data }: ICartesianResponse) =>
  //             this.actions.createSuccess({ entity: data })
  //           ),
  //           catchError(({ errors, message }: ICartesianResponse) =>
  //             of(this.actions.createFailure({ errors, message }))
  //           )
  //         );
  //       }
  //     })
  //   )
  // );
}

