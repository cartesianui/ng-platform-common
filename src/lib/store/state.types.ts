import { EntityState as NgRxEntityState } from '@ngrx/entity';

export type Pagination = {
  total: number;
  count: number;
  perPage: number;
  currentPage: number;
  totalPages: number;
  links: Object;
};

export type RequestTypes = 'get' | 'create' | 'update' | 'delete' | 'request' | 'all';

export enum RequestType {
  Get = 'get',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Request = 'request',
  All = 'all'
}

export type RequestState = { started: boolean; completed: boolean; failed: boolean };

export type ResponseMeta = { pagination: Pagination } & { [key: string]: any };

export type BaseState<T> = T;

export type Entity<E> = {
  data: E | null;
};

export type EntityList<E> = {
  data: {
    data: Array<E> | null;
    meta: object;
  };
};

export type EntityState<E> = BaseState<Entity<E>>;

export type EntityListState<E> = BaseState<EntityList<E>>;

export interface EntityStateExtended<T> extends NgRxEntityState<T> {
  meta: ResponseMeta | null;
  request: RequestState | undefined; // General Request
  get: RequestState | undefined; // General Request
  create: RequestState | undefined; // Create Request
  update: RequestState | undefined; // Update Request
  delete: RequestState | undefined; // General Request
}

/**
 *
 * @param meta meta property from current state
 * @param action add | delete
 *
 * Updates pagination on add or delete actions
 * @returns
 */

export const updateMetaState = (meta: ResponseMeta, action: string): ResponseMeta => {
  if (!meta?.pagination) return meta;
  switch (action) {
    case 'add':
      return { ...meta, pagination: { ...meta.pagination, total: meta.pagination.total + 1, count: meta.pagination.count + 1 } };
    case 'delete':
      return { ...meta, pagination: { ...meta.pagination, total: meta.pagination.total - 1, count: meta.pagination.count - 1 } };
  }
};

export const requestDefault: RequestState = { started: false, completed: false, failed: false };
export const requestStarted: RequestState = { started: true, completed: false, failed: false };
export const requestCompleted: RequestState = { started: false, completed: true, failed: false };
export const requestFailed: RequestState = { started: false, completed: false, failed: true };
