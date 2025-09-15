import { InjectionToken } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { SearchForm } from '@cartesianui/core';

export type ChildComponent = { [key: string]: string | { [key: string]: string } };

export type ChildComponentSelected<C> = C[keyof C];

export interface IHasForm<T = any> {
  toForm(patch?: Partial<T>): FormGroup;
  fromForm(formGroup?: FormGroup): this;
}

export interface EntityStatic<T> {
  new (data?: any): T;
  getDataTableCols?(): any[];
  getDataTableHeaders?(): any[];
  getSearchForm?(): SearchForm;
  toForm?(patch?: Partial<this>): FormGroup;
  fromForm?(FormGroup): T;
}

export const ENTITY_CONSTRUCTOR = new InjectionToken<EntityStatic<any>>('ENTITY_CONSTRUCTOR');