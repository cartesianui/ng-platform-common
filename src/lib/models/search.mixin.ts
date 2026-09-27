import { SearchForm } from '@cartesianui/core';
import { SearchFieldDescriptor } from './types';
import { toReadableName } from './datatable.utils';
import { FieldMetaBuilder } from './utils';

type Constructor<T = {}> = new (...args: any[]) => T;

export function SearchMixin<TBase extends Constructor>(Base: TBase) {
  return class SearchBase extends Base {

    static get searchForm(): SearchForm {
      return {};
    }

    static getSearchForm(): SearchForm {
      const fromDecorators = FieldMetaBuilder.buildSearch(this);
      return Object.keys(fromDecorators).length > 0 ? fromDecorators : this.searchForm;
    }

    static getSearchFields(): SearchFieldDescriptor[] {
      return FieldMetaBuilder.buildSearchFields(this);
    }

    static readableName(key: string): string {
      return toReadableName(key);
    }
  };
}
