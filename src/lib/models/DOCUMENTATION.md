# Models Module

Base model system for CartesianUI. Provides entity definition, form binding, datatable formatting, search/filter panels, export, and value display logic.

## File Structure

```
models/
  types.ts              # Type definitions (FieldDescriptor, FormatterOptions, ValueMap, SearchFieldDescriptor, etc.)
  core.model.ts         # CoreModel — slim base with init(), clone(), toJSON(), fromJSON()
  base.model.ts         # BaseModel — full model composed from mixin chain
  formatter.mixin.ts    # Mixin: getValue(), formatValue()
  formatter.registry.ts # FormatterRegistry — central registry for all formatters
  form.mixin.ts         # Mixin: toForm(), fromForm(), dbFormatted(), formFormatted()
  datatable.mixin.ts    # Mixin: dtFormatted(), getDataTableHeaders()
  search.mixin.ts       # Mixin: getSearchForm(), getSearchFields()
  formatter.utils.ts    # Pure functions for value formatting (date, currency, multiline, badges)
  form.utils.ts         # Pure functions for form <-> model conversion
  datatable.utils.ts    # Pure functions for datatable cell formatting
  utils.ts              # Decorators: @EntityMeta, @ListMeta, @FormMeta, @SearchMeta
  index.ts              # Barrel exports
widgets/
  search-panel/
    search-panel.component.ts  # Auto-generated search/filter panel
services/
  export.service.ts     # ExportService — CSV/XLSX export with criteria
```

## BaseModel

All entity models extend `BaseModel`. It provides:

- **Core**: `init()`, `clone()`, `fromJSON()`, `toJSON()`, `getValue()`
- **Forms**: `toForm()`, `fromForm()`, `dbFormatted()`, `formFormatted()`
- **DataTable**: `dtFormatted()`, static `getDataTableCols()`, `getDataTableHeaders()`
- **Search**: static `getSearchForm()`, static `getSearchFields()`

---

## @EntityMeta Decorator

The `@EntityMeta` class decorator is the **recommended approach** for defining entity metadata. Single unified configuration at the top of the class.

### Config

| Property | Type | Description |
|----------|------|-------------|
| `list` | `FieldDescriptor[]` | Datatable column definitions |
| `form` | `FieldDescriptor[]` | Form field definitions |
| `search` | `(string \| SearchFieldDescriptor)[] \| Record<string, WhereItem>` | Search field definitions (array format recommended, legacy object still supported) |

All three properties are optional — include only what the entity needs.

### Real-World Example: PurchaseOrder

Shows multiline columns, badges, currency formatting, entity/select/daterange search, and option values pattern.

```typescript
import { BaseModel, DateFormat, toLabel, EntityMeta } from '@cartesianui/common';
import { Validators } from '@angular/forms';

export const PurchaseOrderStatuses = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  RECEIVED: 'received',
  CANCELLED: 'cancelled'
} as const;

export type PurchaseOrderStatus = (typeof PurchaseOrderStatuses)[keyof typeof PurchaseOrderStatuses];

@EntityMeta({
  list: [
    // Multiline: document number + date on second line
    { key: 'documentNumber', label: 'PO#', opt: {
      link: true,
      formatter: {
        type: 'multiline', separator: 'br',
        items: [
          { key: 'documentNumber', displayAs: 'text' },
          { key: 'orderedAt', displayAs: 'muted', type: 'date', to: DateFormat.DATETIME_MED }
        ]
      }
    }},
    { key: 'vendor.name', label: 'Vendor', opt: {} },
    // Badge with valueMap
    { key: 'status', label: 'Status', opt: {
      formatter: {
        displayAs: 'badge',
        valueMap: {
          draft:     { label: 'Draft',     color: 'secondary' },
          confirmed: { label: 'Confirmed', color: 'primary' },
          received:  { label: 'Received',  color: 'success' },
          cancelled: { label: 'Cancelled', color: 'danger' }
        }
      }
    }},
    // Multiline: grandTotal + subTotal with currency formatting
    { key: 'grandTotal', label: 'Amount', opt: {
      formatter: {
        type: 'multiline', separator: 'br',
        items: [
          { key: 'grandTotal', displayAs: 'text', type: 'currency', locale: 'en-PK', currency: 'PKR' },
          { key: 'subTotal', displayAs: 'muted', type: 'currency', locale: 'en-PK', currency: 'PKR', prefix: 'Sub: ' }
        ]
      }
    }},
    // Function formatter
    { key: 'items', label: 'Lines', opt: {
      formatter: { type: 'func', func: (val, row) => `${val?.length || 0} line items` }
    }}
  ],
  form: [
    { key: 'vendorId', label: 'Vendor', opt: { validators: [Validators.required] } },
    { key: 'documentNumber', label: 'Document Number', opt: { validators: [] } },
    { key: 'orderedAt', label: 'Order Date', opt: { validators: [Validators.required], formatter: { type: 'date' } } },
    { key: 'status', label: 'Status', opt: { validators: [Validators.required] } },
    { key: 'notes', label: 'Notes', opt: { validators: [Validators.required] } },
    { key: 'subTotal', label: 'Sub Total', opt: { validators: [Validators.required] } },
    { key: 'shippingTotal', label: 'Shipping Total', opt: { validators: [Validators.required] } },
    { key: 'discountTotal', label: 'Discount Total', opt: { validators: [Validators.required] } },
    { key: 'grandTotal', label: 'Grand Total', opt: { validators: [Validators.required] } },
    { key: 'createReceiveNote', label: 'Create Receive Note', opt: { validators: [] } }
  ],
  search: [
    'documentNumber:like',
    { key: 'vendorId', label: 'Vendor', type: 'entity', url: '/vendors' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Confirmed', value: 'confirmed' },
      { label: 'Received', value: 'received' },
      { label: 'Cancelled', value: 'cancelled' }
    ]},
    { key: 'orderedAt', label: 'Order Date', type: 'daterange', operator: 'between' },
  ]
})
export class PurchaseOrder extends BaseModel implements IPurchaseOrder {
  id?: string;
  vendorId: string;
  documentNumber: string;
  orderedAt: string;
  status: PurchaseOrderStatus;
  grandTotal?: number;
  subTotal?: number;
  items: PurchaseOrderItem[];
  // ...

  static getStatusOptions(): { name: string; value: PurchaseOrderStatus }[] {
    return Object.entries(PurchaseOrderStatuses).map(([key, value]) => ({
      name: toLabel(key),
      value: value as PurchaseOrderStatus
    }));
  }
}
```

---

## List Columns

List columns are defined in `@EntityMeta({ list: [...] })` as `FieldDescriptor[]`.

### FieldDescriptor (List)

```typescript
{
  key: string;          // Property name on the model (supports dot notation: 'vendor.name')
  label: string;        // Column header text
  defaultValue?: any;
  opt?: {
    link?: boolean;            // Clickable link in datatable
    width?: string;            // Fixed column width (e.g. '150')
    formatter?: FormatterOptions;
  }
}
```

### FormatterOptions

```typescript
{
  type?: 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func' | 'multiline';
  displayAs?: 'text' | 'badge' | 'tag' | 'label' | 'muted';
  badgeColor?: BadgeColor;
  valueMap?: ValueMap;
  // Date
  from?: DateFormat;
  to?: DateFormat;
  // Currency
  locale?: string;        // e.g. 'en-PK'
  currency?: string;      // e.g. 'PKR', 'USD'
  // Pattern
  pattern?: string;       // e.g. 'firstName lastName'
  // Function
  func?: (value, row?) => any;
  // Multiline
  items?: FormatterOptions[];   // Nested formatters with key
  separator?: 'br' | 'space' | 'none';
  // Style
  class?: string;
  prefix?: string;
  suffix?: string;
}
```

### Formatter Types

#### Date

```typescript
{ key: 'createdAt', label: 'Created', opt: {
  formatter: { type: 'date', to: DateFormat.SHORT }
}}
```

#### Currency

```typescript
{ key: 'price', label: 'Price', opt: {
  formatter: { type: 'currency', locale: 'en-US', currency: 'USD' }
}}
```

#### Number

```typescript
{ key: 'quantity', label: 'Qty', opt: {
  formatter: { type: 'number', locale: 'en-US' }
}}
```

#### Pattern (combine fields)

```typescript
{ key: 'id', label: 'Name', opt: {
  link: true,
  formatter: { type: 'pattern', pattern: 'firstName lastName' }
}}
// Renders: "John Doe" — values substituted from model properties
```

#### Function

```typescript
{ key: 'total', label: 'Total', opt: {
  formatter: { type: 'func', func: (val, row) => `${row.qty} x ${row.price}` }
}}
```

#### Multiline (multiple fields in one cell)

```typescript
{ key: 'name', label: 'Product', opt: {
  formatter: {
    type: 'multiline', separator: 'br',
    items: [
      { key: 'name',        displayAs: 'text' },
      { key: 'genericName', displayAs: 'muted' }
    ]
  }
}}
// Renders:
// Product Name
// generic name (small, muted)
```

Nested items support their own formatters — e.g. a date inside a multiline:

```typescript
items: [
  { key: 'documentNumber', displayAs: 'text' },
  { key: 'orderedAt', displayAs: 'muted', type: 'date', to: DateFormat.DATETIME_MED }
]
```

#### Badge with ValueMap

```typescript
{ key: 'status', label: 'Status', opt: {
  formatter: {
    displayAs: 'badge',
    valueMap: {
      'active':   { label: 'Active',   color: 'success' },
      'disabled': { label: 'Disabled', color: 'danger' }
    }
  }
}}
```

Boolean value maps:

```typescript
valueMap: {
  'true':  { label: 'Yes', color: 'success' },
  'false': { label: 'No',  color: 'danger' },
  '1':     { label: 'Yes', color: 'success' },
  '0':     { label: 'No',  color: 'danger' }
}
```

### DisplayStyles

| `displayAs` | Output |
|-------------|--------|
| `text`      | Plain text (or `<span>` with custom class) |
| `badge`     | `<span class="badge bg-{color}">` |
| `tag`       | `<span class="badge rounded-pill bg-{color}">` |
| `label`     | `<strong>` |
| `muted`     | `<small class="text-muted">` |

### BadgeColor

`'primary'` | `'secondary'` | `'success'` | `'danger'` | `'warning'` | `'info'` | `'dark'` | `'light'`

---

## Form Fields

Form fields are defined in `@EntityMeta({ form: [...] })` as `FieldDescriptor[]`.

### FieldDescriptor (Form)

```typescript
{
  key: string;          // Property name
  label: string;        // Form label
  defaultValue?: any;
  opt?: {
    validators?: ValidatorFn[];
    required?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    formatter?: FormatterOptions;   // For date conversion between form <-> API
  }
}
```

Date fields in forms use `formatter: { type: 'date' }` to auto-convert between form display format and API ISO format.

---

## Search Fields & Search Panel

The search system defines how entity listings can be filtered. Search fields are declared in `@EntityMeta({ search })` and consumed by `<search-panel>` to auto-render filter controls.

### SearchFieldDescriptor

```typescript
{
  key: string;              // camelCase field name (maps to criteria column)
  label?: string;           // Display label (auto-generated from key if omitted)
  operator?: string;        // '=' | 'like' | 'between' | 'in' (default: '=')
  type?: SearchFieldType;   // UI control type (default: 'text')
  // Entity lookup (type: 'entity')
  url?: string;             // API endpoint for selectable-control
  optionField?: string;     // Display field (default: 'name')
  optionKey?: string;       // Value field (default: 'id')
  // Dropdown (type: 'select')
  options?: { label: string; value: string }[];
  // Layout
  placeholder?: string;
  hidden?: boolean;         // Include in criteria but don't render UI
  width?: string;           // Bootstrap col: '2' -> col-md-2 (default: '3')
}
```

### Shorthand Syntax

String shorthand expands to a descriptor automatically:

| Syntax | Expands To |
|--------|-----------|
| `'name'` | `{ key: 'name', operator: '=' }` -- text input |
| `'name:like'` | `{ key: 'name', operator: 'like' }` -- text input with LIKE search |

### SearchFieldType

| Type | Control | Usage |
|------|---------|-------|
| `'text'` | `<input type="text">` | Free text search |
| `'number'` | `<input type="number">` | Numeric filter |
| `'select'` | `<select>` | Dropdown with predefined options |
| `'entity'` | `<selectable-control>` | Entity lookup with typeahead |
| `'date'` | `<input bsDatepicker>` | Single date picker |
| `'daterange'` | `<input bsDaterangepicker>` | Date range picker (produces `criteria.whereBetween()`) |
| `'boolean'` | `<select>` Yes/No | Boolean filter |

### Search Panel Component

The `<search-panel>` component renders a complete search/filter UI from model search field definitions.

```html
<search-panel
  [fields]="searchFields"
  [criteria]="criteria"
  searchKey="name"
  searchPlaceholder="Search products..."
></search-panel>
```

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| `fields` | `SearchFieldDescriptor[]` | Filter field definitions (from model metadata) |
| `criteria` | `RequestCriteria` | Criteria instance to update |
| `searchKey` | `string` | Field for quick search (shows search bar when set) |
| `searchOperator` | `string` | Quick search operator (default: `'like'`) |
| `searchPlaceholder` | `string` | Quick search placeholder text |
| `expanded` | `boolean` | Whether filters panel is expanded (default: `false`) |

#### Two-Zone Layout

- **Quick search bar** (always visible) -- bound to the field specified by `searchKey`. Shows a text input for fast free-text search.
- **Advanced filters** (collapsible) -- auto-rendered from the `fields` array. Each field produces the appropriate control based on its `type`.

#### Features

- Auto-triggers search (debounced 400ms for text, immediate for select/entity/date)
- Active filter count badge
- Clear all button
- Dates formatted as YYYY-MM-DD for API

#### URL Hydration

- Auto-hydrates field values from URL query params on load
- Auto-expands filter panel when URL contains active filters
- Key conversion is automatic: camelCase (app) to snake_case (API) and back

### Search Field Examples

**Entity lookup:**

```typescript
{ key: 'vendorId', label: 'Vendor', type: 'entity', url: '/vendors' }
// Selecting a vendor -> criteria.where('vendorId', '=', '<id>')
// API: ?search=vendor_id:<id>&searchFields=vendor_id:=
```

**Status dropdown:**

```typescript
{ key: 'status', label: 'Status', type: 'select', options: [
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' }
]}
```

**Date range:**

```typescript
{ key: 'orderedAt', label: 'Order Date', type: 'daterange', operator: 'between' }
// Both dates filled -> criteria.whereBetween('orderedAt', ['2026-01-01', '2026-03-31'])
// API: ?search=ordered_at:2026-01-01,2026-03-31&searchFields=ordered_at:between
```

**Custom column width:**

```typescript
{ key: 'name', operator: 'like', width: '4' },       // col-md-4 (wider)
{ key: 'status', type: 'select', width: '2', options: [...] }  // col-md-2 (narrower)
```

**Hidden filter (criteria only, no UI):**

```typescript
{ key: 'tenantId', hidden: true }
```

---

## RequestCriteria

Reactive criteria builder that compiles where clauses, ordering, pagination, and relations into API query params. Built on Angular signals.

### Methods

| Method | Description |
|--------|-------------|
| `where(column, value)` | Exact match: `where('status', 'active')` |
| `where(column, operator, value)` | With operator: `where('name', 'like', 'john')` |
| `whereBetween(column, [from, to])` | Range: `whereBetween('price', [100, 500])` |
| `whereIn(column, values)` | In set: `whereIn('status', ['a', 'b'])` |
| `with(relation)` | Include relation: `with('vendor,items')` |
| `orderBy(column, direction)` | Sort: `orderBy('name', 'asc')` |
| `orderByDesc(column)` | Sort descending: `orderByDesc('createdAt')` |
| `orderByRelation(relation, column, direction)` | Sort by relation: `orderByRelation('vendor', 'name', 'desc')` |
| `page(n)` | Set page number |
| `limit(n)` | Set per-page limit (default: 30) |
| `searchJoin(comparison)` | `'and'` (default) or `'or'` logic |
| `filter(columns)` | Response field filter: `filter(['name', 'status'])` |

### Operators

| Operator | Method | API Query |
|----------|--------|-----------|
| `=` | `criteria.where('status', 'active')` | `?search=status:active&searchFields=status:=` |
| `like` | `criteria.where('name', 'like', 'john')` | `?search=name:john&searchFields=name:like` |
| `between` | `criteria.whereBetween('price', [100, 500])` | `?search=price:100,500&searchFields=price:between` |
| `in` | `criteria.whereIn('status', ['a', 'b'])` | `?search=status:a,b&searchFields=status:in` |

Relation ordering:

```
criteria.orderByRelation('vendor', 'name', 'desc')
// -> ?orderBy=vendor|name&sortedBy=desc

criteria.orderByRelation('posts:custom_id', 'title')
// -> ?orderBy=posts:custom_id|title&sortedBy=asc
```

### Computed Getters

All are Angular `computed()` signals -- reactively update when wheres/orders/pagination change.

| Getter | Return Type | Description |
|--------|-------------|-------------|
| `criteria` | `Fields` | Raw criteria object with search, searchFields, orderBy, etc. |
| `pairs` | `Pairs` | Flattened key-value pairs (semicolon-joined arrays) |
| `queryString` | `string` | URL-encoded query string |
| `httpParams` | `HttpParams` | Angular HttpParams for HTTP calls |
| `urlParams` | `string` | Minimal URL params string for browser URL bar |

### URL Hydration

```typescript
criteria.hydrateFromUrl(params: Record<string, string>)
```

Parses `search=name:John;status:active` and `searchFields=name:like;status:=` from URL query params. Automatically converts API-format keys (snake_case) back to app-format (camelCase) when `AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP`.

### Key Conversion

Automatic camelCase (app) to snake_case (API) conversion in both directions:

- `toCriteria()`: converts `camelCase` model keys to `snake_case` for API query params
- `hydrateFromUrl()`: converts `snake_case` URL params back to `camelCase` for model properties

Configured via `AppConfig.keysFormatAPI` and `AppConfig.keysFormatAPP`.

---

## Formatter Registry

All formatters (built-in and custom) go through `FormatterRegistry`, a central registry mapping formatter type strings to formatting functions.

- **Built-in**: `date`, `jdate`, `number`, `currency`, `pattern`, `func`, `multiline` -- registered at module init
- **Custom**: registered by any library via `FormatterRegistry.register()`
- `formatValue()` performs a single registry lookup to find and execute the correct formatter

### Registering a Custom Formatter

```typescript
FormatterRegistry.register('age', (target, value, formatter, model) => {
  if (!value || target !== 'dt') return value;
  const birth = DatetimeService.fromISO(value);
  const years = Math.floor(DateTime.now().diff(birth, 'years').years);
  return `${years} yrs`;
});

// Use in any model:
{ key: 'birth', label: 'Age', opt: { formatter: { type: 'age' } } }
```

The `target` parameter indicates the rendering context (`'dt'` for datatable, `'form'` for form, `'db'` for API submission), allowing a single formatter to behave differently per context.

---

## Export

`ExportService` handles CSV/XLSX export of listing data. Uses the same criteria (filters, search, sort) with `output=csv|xlsx` appended. Direct HTTP call -- no store involvement.

### Usage in Template

```html
<button (click)="onExport('/products')">Export CSV</button>
<button (click)="onExport('/products', 'xlsx')">Export Excel</button>
```

### Usage in Component

`onExport()` is provided by `ListingControlsComponent`:

```typescript
// Default CSV
onExport('/products')

// Explicit format
onExport('/products', 'xlsx')

// With column filter
onExport('/products', 'csv', ['name', 'category.name', 'status'])
```

### Behavior

- Columns auto-converted to snake_case for the API (`name` -> `name`, `category.name` -> `category.name` with each segment converted)
- Appends `output=csv|xlsx` to existing criteria params
- If `columns` provided, appends `filter=name;category.name;status` (semicolon-separated, snake_case)
- Downloads as blob via browser

### Signature

```typescript
// In ListingControlsComponent:
onExport(endpoint: string, format: ExportFormat = 'csv', columns?: string[]): void

// ExportService:
export(endpoint: string, params: HttpParams, format: ExportFormat = 'csv', columns?: string[], filename?: string): void
```

---

## Option Values Pattern

For fields with a fixed set of values (status, type, category, etc.), define a `const` object, derive a type, and add a static `getXxxOptions()` method.

### Defining Constants and Types

```typescript
export const ProductStatuses = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DISABLED: 'disabled'
} as const;

export type ProductStatus = (typeof ProductStatuses)[keyof typeof ProductStatuses];

export const ProductTypes = {
  TANGIBLE: 'tangible',
  NONTANGIBLE: 'non-tangible'
} as const;

export type ProductType = (typeof ProductTypes)[keyof typeof ProductTypes];
```

### Adding Option Getters

```typescript
export class Product extends BaseModel implements IProduct {
  type: ProductType;
  status?: ProductStatus;

  static getTypeOptions(): { name: string; value: ProductType }[] {
    return Object.entries(ProductTypes).map(([key, value]) => ({
      name: toLabel(key),     // 'TANGIBLE' -> 'Tangible', 'NONTANGIBLE' -> 'Non Tangible'
      value: value as ProductType
    }));
  }

  static getStatusOptions(): { name: string; value: ProductStatus }[] {
    return Object.entries(ProductStatuses).map(([key, value]) => ({
      name: toLabel(key),
      value: value as ProductStatus
    }));
  }
}
```

### Using in Templates

```html
<!-- Choosable control (radio/checkbox grid) -->
<choosable-control
  formControlName="type"
  [options]="Product.getTypeOptions()"
  optionKey="value"
  optionField="name"
></choosable-control>

<!-- Selectable control (searchable dropdown) -->
<selectable-control
  formControlName="status"
  [options]="Product.getStatusOptions()"
  optionKey="value"
  optionField="name"
  placeholder="Select status"
></selectable-control>
```

### Using Constants in Code

```typescript
if (product.status === ProductStatuses.ACTIVE) { ... }
product.type = ProductTypes.TANGIBLE;
```

The `toLabel()` utility converts `UPPER_CASE` keys to readable labels: `'DRAFT'` -> `'Draft'`, `'NONTANGIBLE'` -> `'Non Tangible'`.

---

## Property-Level Decorators (Alternative)

For fine-grained control, use `@ListMeta`, `@FormMeta`, and `@SearchMeta` on individual properties. The `key` is automatically inferred from the property name.

```typescript
export class Product extends BaseModel implements IProduct {
  @ListMeta({ label: 'Name', opt: { link: true } })
  @FormMeta({ label: 'Name', opt: { validators: [Validators.required] } })
  @SearchMeta({ column: 'name', operator: '=', value: null })
  name: string;

  @ListMeta({ label: 'Status', opt: {
    formatter: { displayAs: 'badge', valueMap: { 'active': { label: 'Active', color: 'success' } } }
  }})
  @FormMeta({ label: 'Status', opt: { validators: [Validators.required] } })
  status?: string;
}
```

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@ListMeta(fd)` | Property | Define datatable column for this property |
| `@FormMeta(fd)` | Property | Define form field for this property |
| `@SearchMeta(where)` | Property | Define search criteria for this property |

---

## CLI Code Generation

The `cui update model` command auto-generates metadata by reading interface properties from the model file.

**Prerequisites:** Manually define the interface and class properties first.

```typescript
export interface IProduct {
  id?: string;
  name: string;
  sku: string;
  price: number;
  status?: string;
}

export class Product extends BaseModel implements IProduct {
  id?: string;
  name: string;
  sku: string;
  price: number;
  status?: string;
}
```

Then generate metadata:

```bash
# Default -- @EntityMeta decorator (recommended)
cui update model --lib=Catalog --entities=Product

# Property decorators -- @ListMeta, @FormMeta, @SearchMeta per property
cui update model --lib=Catalog --entities=Product --hydrate=attribute

# Static overrides -- static properties (deprecated)
cui update model --lib=Catalog --entities=Product --hydrate=fields
```

The CLI reads the interface, extracts field names, and generates scaffolding. Customize the output after generation -- add formatters, adjust validators, set `link: true`, etc.

---

## Listing Component Pattern

How a listing component is structured using the model metadata system.

### Component Class

```typescript
import { SearchPanelComponent } from '@cartesianui/common';

@Component({
  imports: [...LISTING_IMPORTS, AppDatatableComponent, SearchPanelComponent],
})
export class ProductListingComponent extends ListingControlsComponent<IProduct> {
  entityConstructor = Product;   // Or inject via ENTITY_CONSTRUCTOR

  ngOnInit(): void {
    this.loadEntityMetadata();   // Populates columns, headers, searchForm, searchFields
    this.initCriteria();         // Creates criteria, hydrates from URL, sets up reactive effect
  }

  list(): void {
    // Dispatch store action using this.criteria.httpParams()
    this.store.dispatch(new ListProducts(this.criteria.httpParams()));
  }
}
```

### Key Methods from ListingControlsComponent

| Method | Description |
|--------|-------------|
| `loadEntityMetadata()` | Reads `@EntityMeta` and populates `columns`, `headers`, `searchForm`, `searchFields` |
| `initCriteria()` | Creates `RequestCriteria` from `searchForm`, hydrates from URL, sets up signal `effect()` that auto-calls `list()` on any criteria change |
| `setPage(event)` | Updates `criteria.page()` from datatable pagination event |
| `setSorting(event)` | Updates `criteria.orderBy()` from datatable sort event |
| `onExport(endpoint, format?, columns?)` | Triggers CSV/XLSX export with current criteria |

### Template

```html
<div class="main-content dt" #dtContainer>
  <!-- Search panel auto-renders filters from model metadata -->
  <search-panel
    [fields]="searchFields"
    [criteria]="criteria"
    searchKey="name"
    searchPlaceholder="Search products..."
  ></search-panel>

  <!-- Page actions: create + export -->
  <page-actions>
    <button (click)="showChildComponent()">Create</button>
    <button (click)="onExport('/products')">Export</button>
  </page-actions>

  <!-- Datatable -->
  <app-datatable
    [rows]="data"
    [columns]="columns"
    [headers]="headers"
    (page)="setPage($event)"
    (sort)="setSorting($event)"
    (select)="onSelect($event)"
  ></app-datatable>
</div>
```

No manual `onSearch()`, `onDateChange()`, or `updateForm()` calls needed -- the search panel writes directly to `criteria`, and the signal effect auto-triggers `list()`.

### Reactive Flow

```
@EntityMeta({ search: [...] })
        |
        v
  FieldMetaBuilder
   |-- buildSearch()        -> SearchForm (for criteria constructor)
   |-- buildSearchFields()  -> SearchFieldDescriptor[] (for search-panel)
        |
        v
  ListingControlsComponent
   |-- loadEntityMetadata() -> populates searchForm + searchFields
   |-- initCriteria()       -> creates RequestCriteria, hydrates URL, sets up effect()
        |
        v
  SearchPanelComponent
   |-- Reads SearchFieldDescriptor[]
   |-- Renders appropriate controls per field type
   |-- On change -> criteria.where() / whereBetween()
        |
        v
  RequestCriteria (reactive signals)
   |-- queryString computed signal changes
   |-- effect() in initCriteria() auto-triggers list()
```

---

## Backward Compatibility

### Legacy Search Object Format

```typescript
// Old format (still supported)
search: {
  name: { column: 'name', operator: '=', value: null },
  email: { column: 'email', operator: '=', value: null },
}
```

Both formats auto-generate `SearchForm` for `criteria.updateForm()` and `SearchFieldDescriptor[]` for `<search-panel>`. Legacy format fields render as plain text inputs only (no type information).

### Static Overrides (Deprecated)

```typescript
// DEPRECATED -- use @EntityMeta instead
export class Product extends BaseModel {
  static override get dataTableCols(): FieldDescriptor[] {
    return [{ key: 'name', label: 'Name', opt: { link: true } }];
  }
  static override formFields: FieldDescriptor[] = [
    { key: 'name', label: 'Name', opt: { validators: [Validators.required] } }
  ];
  static override get searchForm() {
    return { name: { column: 'name', operator: '=', value: null } };
  }
}
```

### Fallback Order

1. **Decorator metadata** (`@EntityMeta` or `@ListMeta`/`@FormMeta`/`@SearchMeta`) -- checked first
2. **Static overrides** (`dataTableCols`, `formFields`, `searchForm`) -- fallback if no decorators

### Methods

- `getSearchForm()` returns the legacy `SearchForm` object for existing consumers
- `getSearchFields()` is the new method -- returns `SearchFieldDescriptor[]` for `<search-panel>`
- The old `onSearch()` + `updateForm()` pattern still works but is deprecated

---

## Types Reference

### FieldDescriptor

```typescript
{
  key: string;
  dataKey?: string;
  label: string;
  defaultValue?: any;
  opt?: {
    link?: boolean;
    width?: string;
    formatter?: FormatterOptions;
    validators?: ValidatorFn[];
    required?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    [prop: string]: any;
  }
}
```

### FormatterOptions

```typescript
{
  key?: string;
  type?: FormatterType;
  from?: DateFormat;
  to?: DateFormat;
  locale?: string;
  currency?: string;
  pattern?: string;
  func?: (value: any, row?: any) => any;
  displayAs?: DisplayStyle;
  badgeColor?: BadgeColor;
  class?: string;
  prefix?: string;
  suffix?: string;
  valueMap?: ValueMap;
  items?: FormatterOptions[];
  separator?: 'br' | 'space' | 'none';
}
```

### ValueMap

```typescript
type ValueMapItem = { label: string; color?: BadgeColor; };
type ValueMap = { [key: string]: ValueMapItem | string; };
```

### SearchFieldDescriptor

```typescript
{
  key: string;
  label?: string;
  operator?: string;
  type?: SearchFieldType;
  url?: string;
  optionField?: string;
  optionKey?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  hidden?: boolean;
  width?: string;
}
```

### Other Types

```typescript
type BadgeColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light';
type DisplayStyle = 'text' | 'badge' | 'tag' | 'label' | 'muted';
type BuiltInFormatterType = 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func' | 'multiline';
type FormatterType = BuiltInFormatterType | (string & {});
type SearchFieldType = 'text' | 'select' | 'entity' | 'date' | 'daterange' | 'number' | 'boolean';
type SearchMetaInput = (string | SearchFieldDescriptor)[] | Record<string, any>;
type ExportFormat = 'csv' | 'xlsx';
```

---

## Utility Functions

### formatter.utils.ts

| Function | Description |
|----------|-------------|
| `formatValue(target, value, formatter, model)` | Route value through correct formatter (via FormatterRegistry lookup) |
| `formatDate(target, value, formatter)` | Date formatting (ISO/custom to display/API) |
| `formatMultiline(formatter, model)` | Render multiline HTML from nested items |
| `evalPattern(pattern, model, getFormatter)` | Replace field keys in pattern string with model values |
| `wrapWithDisplayStyle(value, formatter)` | Wrap value with badge/tag/muted HTML |

### form.utils.ts

| Function | Description |
|----------|-------------|
| `formatForDb(model, col, evalPattern)` | Format field value for API submission |
| `formatForForm(model, col, evalPattern)` | Format field value for form display |
| `toFormGroup(model, fields, formatFn)` | Create Angular FormGroup from model |
| `fromFormGroup(model, formGroup, fields, formatFn)` | Populate model from FormGroup |
| `normalizeFormFields(raw)` | Normalize string[] or FieldDescriptor[] |

### datatable.utils.ts

| Function | Description |
|----------|-------------|
| `formatForDataTable(model, col, evalPattern)` | Format field value for datatable cell |
| `getHeaders(cols, readableName)` | Generate header config with Select column |
| `toReadableName(key)` | Convert `camelCase` to `Camel Case` |

### utils.ts (Decorators)

| Export | Description |
|--------|-------------|
| `@EntityMeta(config)` | Class decorator -- unified list, form, search metadata (recommended) |
| `@ListMeta(fd)` | Property decorator -- datatable column for a single property |
| `@FormMeta(fd)` | Property decorator -- form field for a single property |
| `@SearchMeta(where)` | Property decorator -- search criteria for a single property |
| `FieldMetaBuilder` | Reads decorator metadata: `buildList()`, `buildForm()`, `buildSearch()`, `buildSearchFields()` |
