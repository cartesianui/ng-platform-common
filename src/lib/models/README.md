# Models Module

Base model system for CartesianUI. Provides entity definition, form binding, datatable formatting, and value display logic.

## File Structure

```
models/
  types.ts            # Type definitions (FieldDescriptor, FormatterOptions, ValueMap, etc.)
  base.model.ts       # BaseModel class — slim orchestrator delegating to utils
  formatter.utils.ts  # Pure functions for value formatting (date, currency, multiline, badges)
  form.utils.ts       # Pure functions for form ↔ model conversion
  datatable.utils.ts  # Pure functions for datatable cell formatting
  utils.ts            # Decorator-based metadata (ListMeta, FormMeta, SearchMeta)
  index.ts            # Barrel exports
```

## BaseModel

All entity models extend `BaseModel`. It provides:

- **Core**: `init()`, `clone()`, `fromJSON()`, `toJSON()`, `getValue()`
- **Forms**: `toForm()`, `fromForm()`, `dbFormatted()`, `formFormatted()`
- **DataTable**: `dtFormatted()`, static `dataTableCols`, `getDataTableHeaders()`
- **Search**: static `searchForm`, `getSearchForm()`

### Defining an Entity

```typescript
export class Product extends BaseModel implements IProduct {
  id?: string;
  name: string;
  status?: string;

  // DataTable columns
  static override get dataTableCols(): FieldDescriptor[] {
    return [
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
    ];
  }

  // Form fields
  static override formFields: FieldDescriptor[] = [
    { key: 'name', label: 'Name', opt: { validators: [Validators.required] } },
    { key: 'status', label: 'Status', opt: { validators: [Validators.required] } }
  ];

  // Search criteria
  static override get searchForm() {
    return {
      name: { column: 'name', operator: '=', value: null }
    };
  }
}
```

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
| `@ListMeta(fd)` | Decorator to define datatable columns on properties |
| `@FormMeta(fd)` | Decorator to define form fields on properties |
| `@SearchMeta(where)` | Decorator to define search criteria on properties |
| `FieldMetaBuilder` | Reads decorator metadata: `buildList()`, `buildForm()`, `buildSearch()` |