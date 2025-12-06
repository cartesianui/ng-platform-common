export interface ILoaderState {
  loading: boolean;
  loaded: boolean;
}

export interface IResultState<T> {
  message?: string;
  data?: T;
  meta?: object;
}

export interface IListState<T> {
  message?: string;
  data?: Array<T>;
  meta?: object;
}

export const LOADER_ACTIVE_STATE: ILoaderState = {
  loading: true,
  loaded: false
};

export const LOADER_DEACTIVE_STATE: ILoaderState = {
  loading: false,
  loaded: true
};

export const DEFAULT_LOADER_STATE: ILoaderState = LOADER_DEACTIVE_STATE;
