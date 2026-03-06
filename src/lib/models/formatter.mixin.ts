import { FormatterOptions } from './types';
import { formatValue, formatDate, formatMultiline, wrapWithDisplayStyle, evalPattern } from './formatter.utils';

type Constructor<T = {}> = new (...args: any[]) => T;

interface ICoreModel {
  getValue(property: string): any;
}

export function FormatterMixin<TBase extends Constructor<ICoreModel>>(Base: TBase) {
  return class FormatterBase extends Base {

    format(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
      return formatValue(target, value, formatter, this);
    }

    evalDate(target: 'db' | 'form' | 'dt', value: any, formatter?: FormatterOptions): any {
      return formatDate(target, value, formatter);
    }

    evalMultiline(formatter?: FormatterOptions): string {
      return formatMultiline(formatter, this);
    }

    wrapWithDisplayStyle(value: any, formatter: FormatterOptions): string {
      return wrapWithDisplayStyle(value, formatter);
    }

    evalPattern(pattern: string): string {
      const cls = this.constructor as any;
      const getColFormatter = typeof cls.getDataTableCol === 'function'
        ? (key: string) => cls.getDataTableCol(key)?.opt?.formatter
        : undefined;
      return evalPattern(pattern, this, getColFormatter);
    }
  };
}
