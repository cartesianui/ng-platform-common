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

export type RequestState = {
  started: boolean;
  completed: boolean;
  failed: boolean;
  /**
   * The server's response body, kept ONLY on a failure (`F61`).
   *
   * WHY IT EXISTS. `createFailure({ errors, message })` has always been dispatched WITH the body
   * and the reducer discarded it, so a component using the sandbox could learn only THAT a request
   * failed. That is fine for a message a global handler shows — and useless for a refusal the
   * operator can ANSWER. `DuplicatePaymentSuspected` is exactly that: a 409 whose own docblock
   * calls it *"a warning, not a refusal — the caller confirms by resending"*, carrying a
   * machine-readable `confirm` field naming what to resend. Without this the five payment create
   * screens cannot tell it from any other 409.
   *
   * OPTIONAL, AND POPULATED BY THE CREATE PATH ONLY. `requestStarted` / `requestCompleted` /
   * `requestDefault` are unchanged, so every existing reader sees exactly what it saw before.
   * `update`, `delete` and `get` take the identical one-line change the day something needs them;
   * they are left alone deliberately rather than by oversight, because widening a contract used by
   * every form in admin, care and pos should happen where there is a caller, not on spec.
   *
   * ESTABLISHED BEFORE CHANGING IT, not assumed: `grep -rn "createFailure\|updateFailure\|
   * deleteFailure\|getFailure"` across every project returns **dispatchers only** — 30-odd
   * `of(this.actions.xFailure({ errors, message }))` call sites and the four reducers here. Nothing
   * reads the payload back, and nothing reads `.errors` or `.message` off a request slot. There is
   * no positional consumer to break.
   */
  /**
   * `unknown`, not `any` — made narrow while the slot was still new (user, 2026-09-13).
   *
   * There is exactly one shape flowing through here today and five consumers reading two keys, so
   * this is the cheapest moment it will ever be. `any` in a store used by every form in admin, care
   * and pos means TypeScript helps nobody downstream: a component could dot into a field that
   * exists on one endpoint's error and not another's and find out at runtime. `unknown` forces the
   * consumer to say what it expects, which is the same argument that put `confirm` on the exception
   * rather than into the shared extractor.
   */
  body?: unknown;
};

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
