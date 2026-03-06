# Models Module

Base model system for CartesianUI. Provides entity definition, form binding, datatable formatting, and value display logic.

## File Structure

```
models/
  types.ts            # Type definitions (FieldDescriptor, FormatterOptions, ValueMap, etc.)
  core.model.ts       # CoreModel — slim base with init(), clone(), toJSON(), fromJSON()
  base.model.ts       # BaseModel — full model composed from mixin chain
  formatter.mixin.ts  # Mixin: getValue(), formatValue()
  form.mixin.ts       # Mixin: toForm(), fromForm(), dbFormatted(), formFormatted()
  datatable.mixin.ts  # Mixin: dtFormatted(), getDataTableHeaders()
  search.mixin.ts     # Mixin: getSearchForm()
  formatter.utils.ts  # Pure functions for value formatting (date, currency, multiline, badges)
  form.utils.ts       # Pure functions for form ↔ model conversion
  datatable.utils.ts  # Pure functions for datatable cell formatting
  utils.ts            # Decorators: @EntityMeta, @ListMeta, @FormMeta, @SearchMeta
  index.ts            # Barrel exports
```

## BaseModel

All entity models extend `BaseModel`. It provides:

- **Core**: `init()`, `clone()`, `fromJSON()`, `toJSON()`, `getValue()`
- **Forms**: `toForm()`, `fromForm()`, `dbFormatted()`, `formFormatted()`
- **DataTable**: `dtFormatted()`, static `getDataTableCols()`, `getDataTableHeaders()`
- **Search**: static `getSearchForm()`

---

## Defining an Entity — @EntityMeta (Recommended)

The `@EntityMeta` class decorator is the **recommended approach** for defining entity metadata. It provides a single, unified configuration at the top of the class.

```typescript
import { Validators } from '@angular/forms';
import { BaseModel, EntityMeta, FieldDescriptor } from '@cartesianui/common';

@EntityMeta({
  list: [
    { key: 'name', label: 'Name', opt: { link: true } },
    { key: 'status', label: 'Status', opt: {
      formatter: {
        displayAs: 'badge',
        valueMap: {
          'active':   { label: 'Active',   color: 'success' },
          'disabled': { label: 'Disabled', color: 'danger' }
        }
      }
    }}
  ],
  form: [
    { key: 'name', label: 'Name', opt: { validators: [Validators.required] } },
    { key: 'status', label: 'Status', opt: { validators: [Validators.required] } }
  ],
  search: {
    id: { column: 'id', operator: '=', value: null },
    name: { column: 'name', operator: '=', value: null }
  }
})
export class Product extends BaseModel implements IProduct {
  id?: string;
  name: string;
  status?: string;
}
```

### @EntityMeta Config

| Property | Type | Description |
|----------|------|-------------|
| `list` | `FieldDescriptor[]` | Datatable column definitions |
| `form` | `FieldDescriptor[]` | Form field definitions |
| `search` | `Record<string, WhereItem>` | Search criteria per field |

All three properties are optional — include only what the entity needs.

### Real-World Example

```typescript
@EntityMeta({
  list: [
    { key: 'name', label: 'Name', opt: {
      link: true,
      formatter: { type: 'pattern', pattern: 'name - native (emoji)' }
    }},
    { key: 'alpha2', label: 'Alpha2/Alpha3', opt: {
      formatter: { type: 'pattern', pattern: 'alpha2 / alpha3' }
    }},
    { key: 'isd', label: 'Isd', opt: {} },
    { key: 'capital', label: 'Capital', opt: {} },
    { key: 'currency', label: 'Currency', opt: {} },
  ],
  form: [
    { key: 'name', label: 'Name', opt: { validators: [Validators.required] } },
    { key: 'native', label: 'Native', opt: { validators: [Validators.required] } },
    { key: 'alpha2', label: 'Alpha2', opt: { validators: [Validators.required] } },
    { key: 'alpha3', label: 'Alpha3', opt: { validators: [Validators.required] } },
    { key: 'isd', label: 'ISD', opt: {} },
    { key: 'capital', label: 'Capital', opt: {} },
    { key: 'currency', label: 'Currency', opt: {} },
    { key: 'emoji', label: 'Emoji', opt: {} },
  ],
  search: {
    id: { column: 'id', operator: '=', value: null },
    name: { column: 'name', operator: '=', value: null },
    native: { column: 'native', operator: '=', value: null },
    alpha2: { column: 'alpha2', operator: '=', value: null },
  }
})
export class Country extends BaseModel implements ICountry {
  id?: number;
  name: string;
  native: string;
  alpha2: string;
  alpha3: string;
  isd: string;
  capital: string;
  currency: string;
  emoji: string;
}
```

---

## Property-Level Decorators (Alternative)

For fine-grained control, use `@ListMeta`, `@FormMeta`, and `@SearchMeta` on individual properties. Useful when metadata is tightly coupled to a specific property.

```typescript
import { BaseModel, ListMeta, FormMeta, SearchMeta } from '@cartesianui/common';

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

The `key` is automatically inferred from the property name — no need to specify it.

---

## Option Values Pattern

For fields with a fixed set of values (status, type, category, etc.), define a `const` object for the values, derive a type from it, and add a static `getXxxOptions()` method on the model. This provides type-safe constants and a ready-made options list for dropdowns and `choosable-control`.

### Defining Constants and Types

```typescript
import { BaseModel, toLabel, EntityMeta } from '@cartesianui/common';

// 1. Define const object with allowed values
export const ProductStatuses = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DISABLED: 'disabled'
} as const;

// 2. Derive a type from it
export type ProductStatus = (typeof ProductStatuses)[keyof typeof ProductStatuses];

export const ProductTypes = {
  TANGIBLE: 'tangible',
  NONTANGIBLE: 'non-tangible'
} as const;

export type ProductType = (typeof ProductTypes)[keyof typeof ProductTypes];
```

### Adding Option Getters to the Model

```typescript
@EntityMeta({ ... })
export class Product extends BaseModel implements IProduct {
  type: ProductType;
  status?: ProductStatus;

  // Static methods returning { name, value } arrays for dropdowns
  static getTypeOptions(): { name: string; value: ProductType }[] {
    return Object.entries(ProductTypes).map(([key, value]) => ({
      name: toLabel(key),     // 'TANGIBLE' → 'Tangible', 'NONTANGIBLE' → 'Non Tangible'
      value: value as ProductType
    }));
  }

  static getStatusOptions(): { name: string; value: ProductStatus }[] {
    return Object.entries(ProductStatuses).map(([key, value]) => ({
      name: toLabel(key),     // 'DRAFT' → 'Draft', 'ACTIVE' → 'Active'
      value: value as ProductStatus
    }));
  }
}
```

### Using in Templates

```html
<!-- With choosable-control (radio/checkbox grid) -->
<choosable-control
  formControlName="type"
  [options]="Product.getTypeOptions()"
  optionKey="value"
  optionField="name"
></choosable-control>

<!-- With selectable-control (searchable dropdown) -->
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
// Type-safe comparisons
if (product.status === ProductStatuses.ACTIVE) { ... }

// Type-safe assignments
product.type = ProductTypes.TANGIBLE;
```

The `toLabel()` utility (from `@cartesianui/common`) converts `UPPER_CASE` keys to readable labels: `'DRAFT'` → `'Draft'`, `'NONTANGIBLE'` → `'Non Tangible'`.

---

## Static Overrides (Deprecated)

The old approach using static properties is **deprecated** but still supported for backward compatibility. Decorator metadata takes priority when both exist.

```typescript
// DEPRECATED — use @EntityMeta instead
export class Product extends BaseModel implements IProduct {
  id?: string;
  name: string;

  static override get dataTableCols(): FieldDescriptor[] {
    return [
      { key: 'name', label: 'Name', opt: { link: true } }
    ];
  }

  static override formFields: FieldDescriptor[] = [
    { key: 'name', label: 'Name', opt: { validators: [Validators.required] } }
  ];

  static override get searchForm() {
    return {
      name: { column: 'name', operator: '=', value: null }
    };
  }
}
```

### Fallback Order

The mixins check for metadata in this order:

1. **Decorator metadata** (`@EntityMeta` or `@ListMeta`/`@FormMeta`/`@SearchMeta`) — checked first
2. **Static overrides** (`dataTableCols`, `formFields`, `searchForm`) — fallback if no decorators

---

## CLI Code Generation

The `cui update model` command auto-generates metadata (decorators or static overrides) by reading the interface properties from the model file.

**Prerequisites:** Before running `cui update model`, you must manually define:

1. The **interface** with all properties and their types
2. The **class properties** matching the interface

```typescript
// 1. Define the interface
export interface IProduct {
  id?: string;
  name: string;
  sku: string;
  price: number;
  status?: string;
}

// 2. Define the class with matching properties
export class Product extends BaseModel implements IProduct {
  id?: string;
  name: string;
  sku: string;
  price: number;
  status?: string;
}
```

Then run `cui update model` to generate metadata from the interface fields:

```bash
# Default — generates @EntityMeta decorator (recommended)
cui update model --lib=Catalog --entities=Product

# Property decorators — generates @ListMeta, @FormMeta, @SearchMeta per property
cui update model --lib=Catalog --entities=Product --hydrate=attribute

# Static overrides — generates static properties (deprecated)
cui update model --lib=Catalog --entities=Product --hydrate=fields
```

The CLI reads the `IProduct` interface, extracts field names (`id`, `name`, `sku`, `price`, `status`), and generates the appropriate metadata scaffolding. You should then customize the generated output — add formatters, adjust validators, set `link: true`, etc.

---

## Types

### FieldDescriptor

Defines a field for forms, datatables, or search:

```typescript
{
  key: string;          // Property name on the model
  label: string;        // Display label
  defaultValue?: any;
  opt?: {
    link?: boolean;            // Clickable in datatable
    width?: string;            // Fixed column width
    formatter?: FormatterOptions;
    validators?: ValidatorFn[];
    required?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  }
}
```

### FormatterOptions

Controls how values are displayed in datatables and forms:

```typescript
{
  type?: 'date' | 'jdate' | 'number' | 'currency' | 'pattern' | 'func' | 'multiline';
  displayAs?: 'text' | 'badge' | 'tag' | 'label' | 'muted';
  badgeColor?: BadgeColor;
  valueMap?: ValueMap;
  // Date options
  from?: DateFormat;
  to?: DateFormat;
  // Pattern options
  pattern?: string;       // e.g. 'firstName lastName'
  // Function options
  func?: (value, row?) => any;
  // Multiline options
  items?: FormatterOptions[];   // Nested formatters with key
  separator?: 'br' | 'space' | 'none';
  // Style options
  class?: string;
  prefix?: string;
  suffix?: string;
}
```

### ValueMap

Maps raw values to display labels and colors. Works with `displayAs: 'badge'` or `'tag'`:

```typescript
{
  'draft':    { label: 'Draft',    color: 'secondary' },
  'active':   { label: 'Active',   color: 'success' },
  'disabled': { label: 'Disabled', color: 'danger' }
}

// Also handles booleans:
{
  'true':  { label: 'Yes', color: 'success' },
  'false': { label: 'No',  color: 'danger' },
  '1':     { label: 'Yes', color: 'success' },
  '0':     { label: 'No',  color: 'danger' }
}
```

## Formatter Examples

### Date

```typescript
{ key: 'createdAt', label: 'Created', opt: {
  formatter: { type: 'date', to: DateFormat.SHORT }
}}
```

### Currency

```typescript
{ key: 'price', label: 'Price', opt: {
  formatter: { type: 'currency', currency: 'USD' }
}}
```

### Pattern (combine fields)

```typescript
{ key: 'id', label: 'Name', opt: {
  link: true,
  formatter: { type: 'pattern', pattern: 'firstName lastName' }
}}
```

### Custom Function

```typescript
{ key: 'total', label: 'Total', opt: {
  formatter: { type: 'func', func: (val, row) => `${row.qty} x ${row.price}` }
}}
```

### Multiline (multiple fields in one cell)

```typescript
{ key: 'name', label: 'Product', opt: {
  formatter: {
    type: 'multiline',
    separator: 'br',
    items: [
      { key: 'name',        displayAs: 'text' },
      { key: 'genericName', displayAs: 'muted' }
    ]
  }
}}
```

Renders as:
```
Product Name
generic name (small, muted)
```

### Badge with ValueMap

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

### Display Styles

| `displayAs` | Output |
|-------------|--------|
| `text`      | Plain text (or `<span>` with custom class) |
| `badge`     | `<span class="badge bg-{color}">` |
| `tag`       | `<span class="badge rounded-pill bg-{color}">` |
| `label`     | `<strong>` |
| `muted`     | `<small class="text-muted">` |

## Utility Functions

### formatter.utils.ts

| Function | Description |
|----------|-------------|
| `formatValue(target, value, formatter, model)` | Route value through correct formatter |
| `formatDate(target, value, formatter)` | Date formatting (ISO/custom → display/API) |
| `formatMultiline(formatter, model)` | Render multiline HTML from nested items |
| `evalPattern(pattern, model, getFormatter)` | Replace field keys in pattern string |
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
| `@EntityMeta(config)` | Class decorator — unified list, form, search metadata (recommended) |
| `@ListMeta(fd)` | Property decorator — datatable column for a single property |
| `@FormMeta(fd)` | Property decorator — form field for a single property |
| `@SearchMeta(where)` | Property decorator — search criteria for a single property |
| `FieldMetaBuilder` | Reads decorator metadata: `buildList()`, `buildForm()`, `buildSearch()` |
