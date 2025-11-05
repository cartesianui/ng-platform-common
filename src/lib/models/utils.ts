import 'reflect-metadata';
import { ValidatorFn } from "@angular/forms";

export type Visibility = 'form' | 'listing';

export interface FieldMetaConfig {
  label?: string;
  visibility?: Visibility[];              // which UIs this participates in
  validators?: ValidatorFn[];
  search?: { column: string; operator: string };
  dt?: any;                               // datatable specific opt
  form?: any;                             // form specific opt
}

const META_KEY = Symbol('ui-field-meta');

export function FieldMeta(cfg: FieldMetaConfig) {
  return (target: any, propertyKey: string) => {
    const ctor = target.constructor;
    const all: Record<string, FieldMetaConfig> = Reflect.getMetadata(META_KEY, ctor) ?? {};
    all[propertyKey] = { ...(all[propertyKey] ?? {}), ...cfg };
    Reflect.defineMetadata(META_KEY, all, ctor);
  };
}

function sentenceCase(s: string){ return s.charAt(0).toUpperCase() + s.slice(1); }

export class FieldMetaBuilder {
  static getAll(ctor: any): Record<string, FieldMetaConfig> {
    return Reflect.getMetadata(META_KEY, ctor) ?? {};
  }

  static buildFormFields(ctor: any) {
    const all = this.getAll(ctor);
    return Object.entries(all)
      .filter(([_, meta]) => meta.visibility?.includes('form'))
      .map(([key, meta]) => ({
        key,
        label: meta.label ?? sentenceCase(key),
        opt:{
          validators: meta.validators,
          ...(meta.form ?? {})
        }
      }));
  }

  static buildDataTableFields(ctor: any) {
    const all = this.getAll(ctor);
    return Object.entries(all)
      .filter(([_, meta]) => meta.visibility?.includes('listing'))
      .map(([key, meta]) => ({
        key,
        label: meta.label ?? sentenceCase(key),
        opt: meta.dt ?? {}
      }));
  }

  static buildSearchFields(ctor: any) {
    const all = this.getAll(ctor);
    const searchFields: Record<string, any> = {};
    Object.entries(all)
      .filter(([_, meta]) => meta.search)
      .forEach(([key, meta]) => searchFields[key] = meta.search);
    return searchFields;
  }
}
