import 'reflect-metadata';
import { WhereItem, SearchForm } from '@cartesianui/core';
import { FieldDescriptor, SearchFieldDescriptor, SearchMetaInput } from './types';

const LIST_KEY   = Symbol('list-meta');
const FORM_KEY   = Symbol('form-meta');
const SEARCH_KEY = Symbol('search-meta');
const SEARCH_FIELDS_KEY = Symbol('search-fields-meta');

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
 * Parse a search meta input item (string shorthand or full descriptor) into a SearchFieldDescriptor.
 *
 * Shorthand formats:
 *   'name'        → { key: 'name', operator: '=' }
 *   'name:like'   → { key: 'name', operator: 'like' }
 */
function parseSearchField(item: string | SearchFieldDescriptor): SearchFieldDescriptor {
  if (typeof item === 'string') {
    const [key, operator] = item.split(':');
    return { key, operator: operator || '=' };
  }
  return { operator: '=', ...item };
}

/**
 * Convert SearchFieldDescriptor[] to legacy SearchForm (for backward compat with RequestCriteria).
 */
function searchFieldsToSearchForm(fields: SearchFieldDescriptor[]): SearchForm {
  const form: SearchForm = {};
  for (const f of fields) {
    form[f.key] = { column: f.key, operator: f.operator || '=', value: null };
  }
  return form;
}

/**
 * Class decorator: define list, form, and search metadata in one place.
 * Uses the same metadata keys as @ListMeta, @FormMeta, @SearchMeta.
 *
 * Search accepts two formats:
 *   - New array format: (string | SearchFieldDescriptor)[]
 *     e.g. ['name:like', 'email', { key: 'vendorId', type: 'entity', url: '/vendors' }]
 *   - Legacy object format: Record<string, WhereItem>
 *     e.g. { name: { column: 'name', operator: '=', value: null } }
 */
export function EntityMeta(config: {
  list?: FieldDescriptor[];
  form?: FieldDescriptor[];
  search?: SearchMetaInput;
}) {
  return (ctor: any) => {
    if (config.list) {
      Reflect.defineMetadata(LIST_KEY, config.list, ctor);
    }
    if (config.form) {
      Reflect.defineMetadata(FORM_KEY, config.form, ctor);
    }
    if (config.search) {
      if (Array.isArray(config.search)) {
        // New array format → parse into SearchFieldDescriptor[]
        const fields = config.search.map(parseSearchField);
        Reflect.defineMetadata(SEARCH_FIELDS_KEY, fields, ctor);

        // Also store as legacy SearchForm for backward compat
        const searchForm = searchFieldsToSearchForm(fields);
        const searchMap: Record<string, WhereItem[]> = {};
        Object.entries(searchForm).forEach(([k, v]) => { searchMap[k] = [v]; });
        Reflect.defineMetadata(SEARCH_KEY, searchMap, ctor);
      } else {
        // Legacy object format { key: WhereItem }
        const searchMap: Record<string, WhereItem[]> = {};
        Object.entries(config.search).forEach(([k, v]) => { searchMap[k] = [v as WhereItem]; });
        Reflect.defineMetadata(SEARCH_KEY, searchMap, ctor);

        // Also derive SearchFieldDescriptor[] from legacy format
        const fields: SearchFieldDescriptor[] = Object.entries(config.search).map(([k, v]: [string, any]) => ({
          key: k,
          operator: v.operator || '='
        }));
        Reflect.defineMetadata(SEARCH_FIELDS_KEY, fields, ctor);
      }
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

  static buildSearchFields(ctor:any): SearchFieldDescriptor[] {
    return Reflect.getMetadata(SEARCH_FIELDS_KEY, ctor) ?? [];
  }
}
