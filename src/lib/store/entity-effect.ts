import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, EMPTY } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Update,  } from '@ngrx/entity';
import { ICartesianResponse, IHttpService, RequestCriteria } from '@cartesianui/core';
import { entityActions } from './entity-actions.util';

export abstract class EntityEffect<TModel> {
  protected actions$ = inject(Actions);

  constructor(
    protected httpService: IHttpService<TModel>,
    protected actions: ReturnType<typeof entityActions<TModel, any>> // typed action creators
  ) {}

  fetchAll$ = createEffect(() => {
    //console.log('fetchAll action:', this.actions.fetchAll);
    return this.actions$.pipe(
      ofType(this.actions.fetchAll),
      map((action: any) => action.criteria),
      switchMap((criteria: RequestCriteria) =>
        this.httpService.getAll(criteria).pipe(
          map(({ data, meta }: ICartesianResponse) =>
            this.actions.load({ entities: data, meta })
          ),
          catchError(({ errors, message }: ICartesianResponse) =>
            of(this.actions.fetchFailure({ errors, message }))
          )
        )
      )
    )
  });
    

  fetchById$ = this.httpService.getById
    ? createEffect(() => this.actions$.pipe(
        ofType(this.actions.fetchById),
        map((action: any) => action.id),
        switchMap((id: string) =>
          this.httpService.getById!(id).pipe(
              map(({ data }: ICartesianResponse) =>
                this.actions.updateSuccess({ entity: data })
              ),
              catchError(({ errors, message }: ICartesianResponse) =>
                of(this.actions.fetchFailure({ errors, message }))
              )
            )
          )
        )
      )
    : () => EMPTY;

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.create),
      map((action: any) => action.entity),
      switchMap((entity: TModel) =>
        this.httpService.create(entity).pipe(
          map(({ data }: ICartesianResponse) =>
            this.actions.createSuccess({ entity: data })
          ),
          catchError(({ errors, message }: ICartesianResponse) =>
            of(this.actions.createFailure({ errors, message }))
          )
        )
      )
    )
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.update),
      map((action: any) => action.entity),
      switchMap(({ id, changes }: Update<TModel>) =>
        this.httpService.update(id as string, changes).pipe(
          map(({ data }: ICartesianResponse) =>
            this.actions.updateSuccess({ entity: data })
          ),
          catchError(({ errors, message }: ICartesianResponse) =>
            of(this.actions.updateFailure({ errors, message }))
          )
        )
      )
    )
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(this.actions.delete),
      map((action: any) => action.id),
      switchMap((id: string) =>
        this.httpService.delete(id).pipe(
          map(() => ({ type: '[Noop] Delete Success' })),
          catchError(() => EMPTY) // You can dispatch failure if needed
        )
      )
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

