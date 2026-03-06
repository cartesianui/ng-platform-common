import { FieldDescriptor } from './types';
import { formatForDataTable, getHeaders, toReadableName } from './datatable.utils';
import { FieldMetaBuilder } from './utils';

type Constructor<T = {}> = new (...args: any[]) => T;

interface IFormatterModel {
  getValue(property: string): any;
  init(data?: Record<string, any>): any;
  evalPattern(pattern: string): string;
}

export function DataTableMixin<TBase extends Constructor<IFormatterModel>>(Base: TBase) {
  return class DataTableBase extends Base {

    static get dataTableCols(): FieldDescriptor[] {
      return [];
    }

    static getDataTableCols(): FieldDescriptor[] {
      const fromDecorators = FieldMetaBuilder.buildList(this);
      return fromDecorators.length > 0 ? fromDecorators : this.dataTableCols;
    }

    static getDataTableCol(key: string): FieldDescriptor | undefined {
      return this.getDataTableCols()?.find((field: FieldDescriptor) => field.key === key);
    }

    static getDataTableHeaders(): { name: string; prop?: string }[] {
      return getHeaders(this.getDataTableCols(), toReadableName);
    }

    dtFormatted(col: FieldDescriptor): any {
      return formatForDataTable(this, col, (p) => this.evalPattern(p));
    }
  };
}
