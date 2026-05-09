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

/**
 * Project an object to just the keys declared in its `@EntityMeta({ form: [...] })`.
 *
 * Useful when sending an entity (often a fully-hydrated, transformer-loaded one
 * with nested relations) back to the API as part of an update payload — the
 * server only wants the form-shaped fields, not the full tree.
 *
 * Example:
 *   updatedEntity.items = (this.items ?? []).map(i => pickFormFields(i, ReceiveNoteItem));
 *
 * Unknown keys are dropped. Undefined values are dropped. Empty strings are
 * coerced to null — an optional FK control that was never filled ships `""`
 * from Angular, which then violates FK constraints on insert. `null` is the
 * right wire shape for "no value."
 */
export function pickFormFields<T extends object>(entity: T, ctor: any): Partial<T> {
  const keys = FieldMetaBuilder.buildForm(ctor).map(f => f.key);
  const out: any = {};
  for (const k of keys) {
    const v = (entity as any)[k];
    if (v === undefined) continue;
    out[k] = v === '' ? null : v;
  }
  return out;
}

/**
 * Walk an entity's own enumerable properties and project any nested model
 * instance (or array of instances) through `pickFormFields`, using the
 * instance's own constructor as the projection schema.
 *
 * "Is a model" is detected by checking whether the value's constructor has
 * `@EntityMeta({ form: [...] })` declared. Plain POJOs, primitives, dates,
 * and arrays of POJOs are passed through unchanged.
 *
 * Mutates and returns the same entity reference.
 *
 * Why: parent-doc edit/create pages used to call this manually for items
 * arrays (`entity.items = items.map(i => pickFormFields(i, ItemCtor))`).
 * That boilerplate was per-page, easy to forget, and mismatched with the
 * `getEntityFromForm` contract which already projects the parent. By doing
 * the recursive project here, parent forms with nested model arrays/objects
 * (items, lines, charges, attachments — any name) ship a clean payload
 * without the page knowing the child constructors.
 */
export function projectNestedFormFields<T extends object>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;

  for (const [key, value] of Object.entries(entity)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const sample = value[0];
      const ctor = sample?.constructor;
      if (ctor && FieldMetaBuilder.buildForm(ctor).length > 0) {
        (entity as any)[key] = value.map(i => pickFormFields(i, i?.constructor ?? ctor));
      }
      continue;
    }

    if (value && typeof value === 'object') {
      const ctor = (value as any).constructor;
      // Skip Date and any non-Object-derived value with a tagged ctor; only
      // dive into objects whose ctor carries form-meta.
      if (ctor && ctor !== Object && FieldMetaBuilder.buildForm(ctor).length > 0) {
        (entity as any)[key] = pickFormFields(value as any, ctor);
      }
    }
  }

  return entity;
}
