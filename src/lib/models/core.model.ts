import { FormGroup } from '@angular/forms';

export class CoreModel {

  constructor(data?: Record<string, any> | FormGroup) {
    if (data) {
      if (data instanceof FormGroup) {
        if (typeof (this as any).fromForm === 'function') {
          (this as any).fromForm(data);
        }
      } else {
        this.init(data);
      }
    }
  }

  // ============================================
  // Core Model Methods
  // ============================================

  init(data?: Record<string, any>): this {
    return this.fromJSON(data);
  }

  clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  fromJSON(json?: Record<string, any>): this {
    if (json) {
      for (const property in json) {
        if (Object.prototype.hasOwnProperty.call(json, property)) {
          (this as any)[property] = json[property];
        }
      }
    }
    return this;
  }

  toJSON(): Record<string, any> {
    const json: Record<string, any> = {};

    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = (this as any)[key];
        if (typeof value !== 'function') {
          json[key] = value;
        }
      }
    }

    return json;
  }

  getValue(property: string): any {
    if (!property.includes('.')) {
      return Object.prototype.hasOwnProperty.call(this, property) ? this[property] : null;
    }
    return property.split('.').reduce((obj, key) => obj?.[key], this as any) ?? null;
  }
}
