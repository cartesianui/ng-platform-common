# Datatable Module

Listing infrastructure for CartesianUI. Provides a base controller class for all listing pages and a shared datatable wrapper component.

## File Structure

```
datatable/
  listing-controls.component.ts   # Abstract base class — pagination, sorting, selection, criteria
  datatable.component.ts           # Shared wrapper — centralizes template boilerplate
  datatable.component.html         # Wrapper template with default config + content projection
  datatable-column.directive.ts    # Directive for custom/extra column templates
  datatable-detail.directive.ts    # Directive for row-detail content projection
  types.ts                         # IPaginationModel, IPaginationLinks
  index.ts                         # Barrel exports
```

## Architecture

```
ListingControlsComponent (abstract base — logic layer)
  └── provides: columns, headers, selected, pagination, criteria
  └── methods: setPage(), setSorting(), onSelect(), loadEntityMetadata(), initCriteria()

AppDatatableComponent (template layer)
  └── wraps <ngx-datatable> with sensible defaults
  └── renders checkbox column, dynamic columns, cell formatting
  └── supports custom column overrides via dtColumn directive
  └── supports expandable row-detail via [detailTemplate] input
```

## ListingControlsComponent

Abstract base class that all listing pages extend. Handles data flow, pagination, search criteria, and selection state.

### Usage

```typescript
@Component({
  selector: 'admin-product-list',
  templateUrl: 'listing.component.html',
  imports: [...LISTING_IMPORTS],
  providers: [{ provide: ENTITY_CONSTRUCTOR, useValue: Product }],
  standalone: true
})
export class ProductListingComponent
  extends ListingControlsComponent<IProduct, ProductChildComponent>
  implements OnInit {

  sb = inject(ProductSandbox);

  ngOnInit(): void {
    this.loadEntityMetadata();   // loads columns, headers, searchForm from Product model
    this.initCriteria();         // creates reactive criteria, auto-calls list() on change
  }

  protected list(): void {
    this.sb.product.getAll(this.criteria.httpParams());
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `{ key, label }[]` | Column definitions from entity model |
| `headers` | `{ name, prop? }[]` | Header config passed to ngx-datatable |
| `selected` | `TDataModel[]` | Currently selected rows |
| `pagination` | `IPaginationModel` | Pagination state (default: page 1, 30/page) |
| `criteria` | `RequestCriteria` | Reactive search/filter criteria |
| `searchForm` | `SearchForm` | Search field definitions from entity model |
| `dtContainer` | `ElementRef` | Template ref for busy state overlay |

### Methods

| Method | Description |
|--------|-------------|
| `loadEntityMetadata()` | Reads `dataTableCols`, `headers`, `searchForm` from entity class |
| `initCriteria()` | Creates criteria with reactive effect — auto-calls `list()` on change |
| `setPage(event)` | Handle pagination from ngx-datatable `(page)` event |
| `setSorting(event)` | Handle sorting from ngx-datatable `(sort)` event |
| `onSelect(event)` | Handle row selection, emits `selectedChange` and `cbClick` |
| `getOffsetFromPagination()` | Convert current page to zero-based offset |
| `handleBusyState(state)` | Show/hide loading overlay on `#dtContainer` |
| `hydrateSearchCriteria()` | Read search params from URL query string |
| `list()` | **Abstract** — must implement to call sandbox fetch |

## AppDatatableComponent

Shared wrapper that replaces ~50 lines of repeated ngx-datatable boilerplate in every listing template.

### Inputs

**Required:**

| Input | Type | Description |
|-------|------|-------------|
| `rows` | `any[]` | Data array (e.g., `sb.product.entities()`) |
| `columns` | `FieldDescriptor[]` | Column definitions (drives `*ngFor`) |
| `headers` | `{ name, prop? }[]` | Passed to ngx-datatable `[columns]` |
| `count` | `number` | Total record count for pagination |
| `offset` | `number` | Current page offset (zero-based) |
| `limit` | `number` | Records per page |

**Optional (with defaults):**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `selected` | `any[]` | `[]` | Selected rows |
| `tableClass` | `string` | `'material'` | CSS class (`'material'`, `'material compact'`) |
| `columnMode` | `string` | `'force'` | ngx-datatable column mode |
| `headerHeight` | `number` | `50` | Header row height |
| `footerHeight` | `number` | `50` | Footer row height |
| `rowHeight` | `number \| string` | `43` | Data row height |
| `externalPaging` | `boolean` | `true` | Enable server-side paging |
| `selectionType` | `string` | `'checkbox'` | Selection mode |
| `sortType` | `string` | `'single'` | Sort mode |
| `showCheckboxColumn` | `boolean` | `true` | Show checkbox select column |
| `detailRowHeight` | `number \| string` | `'auto'` | Row-detail expanded height |
| `detailTemplate` | `TemplateRef` | `null` | Template for expandable row detail |

### Outputs

| Output | Description |
|--------|-------------|
| `selectChange` | Row selection changed |
| `pageChange` | Page changed |
| `sortChange` | Sort changed |
| `editClick` | Link cell clicked — emits the row |
| `detailToggle` | Row detail expanded/collapsed |

### Public Methods

| Method | Description |
|--------|-------------|
| `toggleExpandRow(row)` | Expand/collapse a row's detail (only when `detailTemplate` is provided) |

### Basic Usage

```html
<app-datatable
  [rows]="sb.product.entities()"
  [columns]="columns"
  [headers]="headers"
  [count]="sb.product.pagination()?.total"
  [offset]="getOffsetFromPagination()"
  [limit]="sb.product.pagination()?.perPage"
  [selected]="selected"
  (selectChange)="onSelect($event)"
  (pageChange)="setPage($event)"
  (editClick)="onEdit($event)"
></app-datatable>
```

### With Compact Style

```html
<app-datatable
  tableClass="material compact"
  [rows]="sb.patient.entities()"
  ...
></app-datatable>
```

### Custom Cell Override

Use `dtColumn` directive to replace the default cell template for a specific column:

```html
<app-datatable [rows]="..." [columns]="columns" [headers]="headers" ...>
  <ng-template dtColumn="status" let-row="row" let-col="col">
    <my-status-badge [status]="row.status"></my-status-badge>
  </ng-template>
</app-datatable>
```

The `dtColumn` key must match a column key from the `columns` array.

### Extra Columns (Actions, Buttons)

Use `dtColumn` with a `__` prefix to append extra columns after the dynamic ones:

```html
<app-datatable [rows]="..." [columns]="columns" [headers]="headers" ...>
  <ng-template dtColumn="__actions" columnName="Actions" [columnWidth]="120" let-row="row">
    <button class="btn btn-sm btn-primary" (click)="onEdit(row)">Edit</button>
    <button class="btn btn-sm btn-danger" (click)="onDelete(row)">Delete</button>
  </ng-template>
</app-datatable>
```

### Combining Override + Extra

```html
<app-datatable [rows]="..." [columns]="columns" [headers]="headers" ...>
  <!-- Override: custom component for the 'status' cell -->
  <ng-template dtColumn="status" let-row="row">
    <my-status-dropdown [value]="row.status" (change)="onStatusChange(row, $event)"></my-status-dropdown>
  </ng-template>

  <!-- Extra: actions column -->
  <ng-template dtColumn="__actions" columnName="" [columnWidth]="80" let-row="row">
    <button class="btn btn-sm btn-outline-primary" (click)="onPrint(row)">
      <i class="fa fa-print"></i>
    </button>
  </ng-template>
</app-datatable>
```

### Row Detail (Expandable Rows)

Pass a `TemplateRef` via the `[detailTemplate]` input to enable expandable row content. The wrapper auto-adds an expand/collapse chevron column when a detail template is provided.

Used by: Purchase Order, Delivery Note, Receive Note, Return Note, Journal Voucher.

```html
<app-datatable #dt
  [rows]="sb.purchaseOrder.entities()"
  [columns]="columns" [headers]="headers"
  [count]="sb.purchaseOrder.pagination()?.total"
  [offset]="getOffsetFromPagination()"
  [limit]="sb.purchaseOrder.pagination()?.perPage"
  [selected]="selected"
  [detailTemplate]="poDetail"
  (selectChange)="onSelect($event)"
  (pageChange)="setPage($event)"
  (editClick)="onEdit($event)"
></app-datatable>

<ng-template #poDetail let-row="row" let-expanded="expanded">
  <div class="row p2 ms-0 w-100 dt-detail-content p-2">
    <div class="col-md-2 d-flex justify-content-center align-items-center highlight">
      <div class="diagonal-text ucase"># {{ row.documentNumber }}</div>
    </div>
    <div class="col-md-10">
      <admin-purchase-order-item-list [rows]="row.items"></admin-purchase-order-item-list>
    </div>
    <div class="col-md-12 alert alert-light mt-2">
      <strong>Notes:</strong> {{ row.notes }}
    </div>
  </div>
</ng-template>
```

In the parent `.ts`, toggle expansion via the wrapper's public method:

```typescript
@ViewChild('dt') dt: AppDatatableComponent;

toggleExpandRow(row: any) {
  this.dt.toggleExpandRow(row);
}
```

The wrapper automatically:
- Renders `<ngx-datatable-row-detail>` when `detailTemplate` is provided
- Appends a chevron expand/collapse button column at the end
- Exposes `toggleExpandRow(row)` as a public method
- Emits `detailToggle` when rows expand/collapse

### Convention

| `dtColumn` key | Behavior |
|----------------|----------|
| `status`, `name`, etc. | Overrides cell template for that column |
| `__actions`, `__expand`, etc. | Appends a new column after dynamic columns |

## Types

### IPaginationModel

```typescript
{
  count?: number;        // Current page record count
  currentPage?: number;  // Current page number (1-based)
  perPage?: number;      // Records per page
  total?: number;        // Total records across all pages
  totalPages?: number;   // Total number of pages
  links?: {
    next?: string;
    previous?: string;
  }
}
```

## Cell Rendering

The datatable wrapper uses this rendering priority for each cell:

1. **Custom template** — if parent provides `<ng-template dtColumn="colKey">`, use it
2. **Link cell** — if `col.opt.link === true`, render as `<a>` with `(click)` → `editClick`
3. **HTML cell** — if formatter has `displayAs` or `type: 'multiline'`, render with `[innerHTML]`
4. **Plain cell** — otherwise, render with `{{ row.dtFormatted(col) }}`

This ensures badges, tags, multiline content render correctly while plain text uses efficient interpolation.
