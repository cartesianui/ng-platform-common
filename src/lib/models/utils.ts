import 'reflect-metadata';
import { WhereItem, SearchForm } from '@cartesianui/core';
import { FieldDescriptor } from './types';

const LIST_KEY   = Symbol('list-meta');
const FORM_KEY   = Symbol('form-meta');
const SEARCH_KEY = Symbol('search-meta');

export function ListMeta(fd: Omit<FieldDescriptor, 'key'> & { key?: string }) {
  return (target: any, propertyKey: string) => {
    const ctor = target.constructor;
    const arr: FieldDescriptor[] = Reflect.getMetadata(LIST_KEY, ctor) ?? [];
    arr.push({ key: fd.key ?? propertyKey, ...fd });
    Reflect.defineMetadata(LIST_KEY, arr, ctor);
  };
}

export function FormMeta(fd: Omit<FieldDescriptor,'key'> & { key?: string }) {
  return (target:any, propertyKey:string) => {
    const ctor = target.constructor;
    const arr: FieldDescriptor[] = Reflect.getMetadata(FORM_KEY, ctor) ?? [];
    arr.push({ key: fd.key ?? propertyKey, ...fd });
    Reflect.defineMetadata(FORM_KEY, arr, ctor);
  };
}

export function SearchMeta(where: WhereItem) {
  return (target:any, propertyKey:string) => {
    const ctor = target.constructor;
    const all: Record<string, WhereItem[]> = Reflect.getMetadata(SEARCH_KEY, ctor) ?? {};
    const list = all[propertyKey] ?? [];
    list.push(where);
    all[propertyKey] = list;
    Reflect.defineMetadata(SEARCH_KEY, all, ctor);
  };
}

/**
 * Class decorator: define list, form, and search metadata in one place.
 * Uses the same metadata keys as @ListMeta, @FormMeta, @SearchMeta.
 */
export function EntityMeta(config: {
  list?: FieldDescriptor[];
  form?: FieldDescriptor[];
  search?: SearchForm;
}) {
  return (ctor: any) => {
    if (config.list) {
      Reflect.defineMetadata(LIST_KEY, config.list, ctor);
    }
    if (config.form) {
      Reflect.defineMetadata(FORM_KEY, config.form, ctor);
    }
    if (config.search) {
      // Convert SearchForm { key: WhereItem } to the internal format { key: WhereItem[] }
      const searchMap: Record<string, WhereItem[]> = {};
      Object.entries(config.search).forEach(([k, v]) => { searchMap[k] = [v]; });
      Reflect.defineMetadata(SEARCH_KEY, searchMap, ctor);
    }
  };
}

export class FieldMetaBuilder {
  static buildList(ctor:any): FieldDescriptor[] {
    return Reflect.getMetadata(LIST_KEY, ctor) ?? [];
  }

  static buildForm(ctor:any): FieldDescriptor[] {
    return Reflect.getMetadata(FORM_KEY, ctor) ?? [];
  }

  static buildSearch(ctor:any): SearchForm {
    // flatten: if multiple @Search on same key → last wins OR merge?  
    // your original searchForm is 1 item per key → so take last
    const all: Record<string, WhereItem[]> = Reflect.getMetadata(SEARCH_KEY, ctor) ?? {};
    const final: SearchForm = {};
    Object.entries(all).forEach(([k, arr]) => final[k] = arr[arr.length-1]);
    return final;
  }
}
