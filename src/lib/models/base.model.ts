import { CoreModel } from './core.model';
import { FormatterMixin } from './formatter.mixin';
import { FormMixin } from './form.mixin';
import { DataTableMixin } from './datatable.mixin';
import { SearchMixin } from './search.mixin';

/**
 * BaseModel — composed via mixin chain.
 *
 * Chain: CoreModel → FormatterMixin → FormMixin → DataTableMixin → SearchMixin
 *
 * All entity models extend BaseModel. This single export preserves full
 * backward compatibility — no consumer changes required.
 */
const _BaseModel = SearchMixin(DataTableMixin(FormMixin(FormatterMixin(CoreModel))));

export class BaseModel extends _BaseModel {}
