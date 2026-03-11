# Changelog - @cartesianui/common

All notable changes to the common library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

#### Store — Naming Convention Sync
**Date:** 2026-03-06

Renamed action/effect/sandbox methods to match HTTP service naming:
- `fetchAll` → `getAll`
- `fetchById` → `getById`
- `fetchFailure` → `getFailure`

Affected: `entity-actions.util.ts`, `entity-effect.ts`, `entity-feature.util.ts`, `entity-sandbox.ts`

All concrete entity effects, UI components, and CLI templates updated accordingly.

### Added

#### Models — Decorator-Based Metadata System
**Date:** 2026-03-05
**Files:** `src/lib/models/utils.ts`, `src/lib/models/datatable.mixin.ts`, `src/lib/models/form.mixin.ts`, `src/lib/models/search.mixin.ts`

Introduced a decorator-driven metadata system replacing the old static override pattern.

**New Decorators:**
- `@EntityMeta({ list, form, search })` — class decorator (recommended). Defines datatable columns, form fields, and search criteria in a single config block.
- `@ListMeta(fd)` — property decorator. Defines a datatable column for a single property.
- `@FormMeta(fd)` — property decorator. Defines a form field for a single property.
- `@SearchMeta(where)` — property decorator. Defines search criteria for a single property.

**New Utility:**
- `FieldMetaBuilder` — static class with `buildList()`, `buildForm()`, `buildSearch()` methods that read decorator metadata from a model class.

**Backward Compatibility:**
- All mixins (`DataTableMixin`, `FormMixin`, `SearchMixin`) check decorator metadata first, then fall back to old static overrides (`dataTableCols`, `formFields`, `searchForm`).
- No consumer changes required — existing models using static overrides continue to work.

**Migration:**
```typescript
// Before (deprecated)
export class Product extends BaseModel {
  static override get dataTableCols() { return [...]; }
  static override formFields = [...];
  static override get searchForm() { return {...}; }
}

// After (recommended)
@EntityMeta({
  list: [...],
  form: [...],
  search: {...}
})
export class Product extends BaseModel { ... }
```

**References:**
- Documentation: `src/lib/models/DOCUMENTATION.md`

---

#### Datatable — AppDatatableComponent Wrapper
**Date:** 2026-03-05
**Files:** `src/lib/datatable/datatable.component.ts`, `src/lib/datatable/datatable.component.html`, `src/lib/datatable/datatable-column.directive.ts`, `src/lib/datatable/datatable-detail.directive.ts`

New shared wrapper component that replaces ~50 lines of repeated `<ngx-datatable>` boilerplate in every listing template.

**New Components/Directives:**
- `AppDatatableComponent` (`<app-datatable>`) — wraps `<ngx-datatable>` with sensible defaults (material theme, checkbox selection, external paging, force column mode). Accepts `rows`, `columns`, `headers`, `count`, `offset`, `limit` inputs.
- `DatatableColumnDirective` (`[dtColumn]`) — content projection directive for:
  - **Cell overrides** — `<ng-template dtColumn="status">` replaces the default cell template for a column.
  - **Extra columns** — `<ng-template dtColumn="__actions">` appends new columns (e.g., action buttons).
- `DatatableDetailDirective` (`[dtDetail]`) — marker directive for row detail templates.

**Cell Rendering Priority:**
1. Custom template (via `dtColumn`)
2. Link cell (when `col.opt.link === true`)
3. HTML cell with `[innerHTML]` (when formatter has `displayAs` or `type: 'multiline'`)
4. Plain text interpolation

**Row Detail Support:**
- `[detailTemplate]` input enables expandable row content.
- Auto-adds chevron expand/collapse column.
- `toggleExpandRow(row)` public method for parent components.

**Before/After:**
```html
<!-- Before: ~50 lines of raw ngx-datatable per listing -->
<ngx-datatable [rows]="..." [columns]="..." [columnMode]="..." ...>
  <ngx-datatable-column name="Select" ...>...</ngx-datatable-column>
  <!-- repeat for every column -->
</ngx-datatable>

<!-- After: ~10 lines with app-datatable -->
<app-datatable
  [rows]="sb.product.entities()"
  [columns]="columns" [headers]="headers"
  [count]="sb.product.pagination()?.total"
  [offset]="getOffsetFromPagination()"
  [limit]="sb.product.pagination()?.perPage"
  (pageChange)="setPage($event)"
  (editClick)="onEdit($event)">
</app-datatable>
```

**References:**
- Documentation: `src/lib/datatable/DOCUMENTATION.md`

---

#### Datatable — ENTITY_CONSTRUCTOR Token for Automatic Metadata Loading
**Date:** 2026-03-05
**File:** `src/lib/datatable/listing-controls.component.ts`

`ListingControlsComponent.loadEntityMetadata()` now reads model metadata automatically via the `ENTITY_CONSTRUCTOR` injection token. Listing components provide their model class and get columns, headers, and search form without manual wiring.

```typescript
@Component({
  providers: [{ provide: ENTITY_CONSTRUCTOR, useValue: Product }]
})
export class ProductListingComponent extends ListingControlsComponent<IProduct> {
  ngOnInit() {
    this.loadEntityMetadata();  // auto-populates columns, headers, searchForm
    this.initCriteria();
  }
}
```

---

### Deprecated

#### Models — Static Override Pattern
**Date:** 2026-03-05
**Files:** `src/lib/models/datatable.mixin.ts`, `src/lib/models/form.mixin.ts`, `src/lib/models/search.mixin.ts`

The following static override pattern is deprecated in favor of `@EntityMeta` decorator:
- `static override get dataTableCols(): FieldDescriptor[]`
- `static override formFields: FieldDescriptor[]`
- `static override get searchForm()`

These still work (mixins fall back to them if no decorator metadata is found) but should not be used in new code.

---

### Fixed

#### ListingControlsComponent - ExpressionChangedAfterItHasBeenCheckedError in Navigation Sidebar
**Date:** 2026-01-30
**File:** `src/lib/datatable/listing-controls.component.ts`
**Issue:** ExpressionChangedAfterItHasBeenCheckedError from CoreUI SidebarNavGroupComponent when navigating to listing pages

**Root Cause:**
When navigating to a listing page (e.g., `/admin/sales/delivery-notes`), the `ListingControlsComponent.initCriteria()` creates an effect that immediately calls `list()` during component initialization. This triggers:

1. Component `ngOnInit()` calls `initCriteria()`
2. Effect created at line 93 executes synchronously
3. `list()` calls `fetchAll()` which dispatches NgRx store action
4. Store state changes propagate to CoreUI sidebar component
5. Sidebar's `display` style changes from `'{"display":"block"}'` to `null` during same CD cycle
6. Angular detects change after checking → Error thrown

The error manifested as:
```
ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked.
Previous value: '{"display":"block"}'. Current value: 'null'.
Expression location: _SidebarNavGroupComponent component.
```

**Solution:**
Wrapped `list()` and `appendSearchCriteriaToUrl()` calls in `setTimeout(() => {}, 0)` within the effect (lines 93-98) to defer store dispatches to next event loop tick, allowing Angular to complete current change detection cycle before triggering state changes that affect the sidebar.

**Changes Made:**

1. **`initCriteria()` method** (lines 89-101):
   - Wrapped effect body in `setTimeout(() => {}, 0)`
   - Defers `this.list()` call to next tick
   - Defers `this.appendSearchCriteriaToUrl()` to next tick
   - Added comment explaining the fix

**Impact:**
- ✅ **Fixes all listing pages** that extend ListingControlsComponent
- ✅ **No breaking changes** - data loads imperceptibly later (~1-4ms)
- ✅ **No child component changes needed** - fix is at base class level
- ✅ **Eliminates navigation errors** for all modules (sales, procurement, inventory, etc.)

**Affected Components (Now Working Without Errors):**
- DeliveryNoteListingComponent
- ReturnNoteListingComponent
- ReceiveNoteListingComponent
- SalesOrderListingComponent
- PurchaseOrderListingComponent
- All other listing components extending ListingControlsComponent

**Technical Details:**
The `setTimeout(() => {}, 0)` pattern:
- Defers store dispatch until after navigation/routing is complete
- Allows sidebar component to finish its CD cycle
- Prevents store state changes from affecting unrelated components during initialization
- Same pattern used in SelectableControl fix (see below)

**Testing:**
- ✅ Navigate to `/admin/sales/delivery-notes` - no error
- ✅ Navigate to `/admin/sales/return-notes` - no error
- ✅ Navigate to `/admin/procurement/receive-notes` - no error
- ✅ Sidebar menu expands/collapses correctly
- ✅ Data loads and displays normally
- ✅ Pagination, sorting, filtering work correctly

**References:**
- Related: SelectableControl fix (same pattern)
- Related Issue: CoreUI navigation state management during routing
- Angular NG0100 - ExpressionChangedAfterItHasBeenCheckedError

---

#### SelectableControlComponent - ExpressionChangedAfterItHasBeenCheckedError Resolution
**Date:** 2026-01-30 (Updated: 2026-01-30 - Added typeahead items signal fix)
**File:** `src/lib/form/control/selectable-control.component.ts`
**Issue:** ExpressionChangedAfterItHasBeenCheckedError when using SelectableControl in forms with effects and typeahead searches

**Root Cause:**
SelectableControl's `setValue()`, `setResolvedValue()`, and `items.set()` calls were modifying signals and emitting events synchronously during Angular's change detection cycle. When used in repeatable forms with effects (common pattern in procurement, sales, inventory modules), this caused:

1. User selects option from typeahead
2. SelectableControl modifies signals (`value`, `entity`) synchronously
3. Emits `entityChange` event to parent
4. Parent updates its signals, triggering child effects
5. Child effects patch form during same CD cycle
6. Angular detects form changed after initial check → Error thrown

**Solution:**
Wrapped all signal modifications and event emissions in `setTimeout(() => {}, 0)` to defer operations to the next event loop tick, allowing Angular to complete the current change detection cycle before making changes.

**Changes Made:**

1. **`setValue()` method** (lines 388-453):
   - Wrapped main execution body in `setTimeout(() => {}, 0)`
   - Defers signal updates: `this.value.set()`, `this.entity.set()`
   - Defers emissions: `this.valueChange.emit()`, `this.entityChange.emit()`
   - Defers form callbacks: `this.onChange()`, `this.onTouched()`
   - Defers change detection: `this.cdr.markForCheck()`

2. **`setResolvedValue()` method** (lines 455-548):
   - Wrapped null-value branch in `setTimeout(() => {}, 0)`
   - Wrapped multi/single select branches in `setTimeout(() => {}, 0)`
   - Prevents errors when called from effects (lines 212, 281, 288, 305)

3. **`items.set()` calls** (typeahead data updates):
   - Line ~278: Wrapped HTTP response items.set() in setTimeout (tap operator)
   - Line ~308: Wrapped static data items.set() in setTimeout
   - Line ~315: Wrapped empty array items.set() in setTimeout
   - Line ~359: Wrapped fetchById items.set() in setTimeout
   - Prevents TypeaheadContainerComponent from detecting array changes during same CD cycle

**Impact:**
- ✅ **Fixes all modules** using SelectableControl (procurement, sales, inventory, POS)
- ✅ **No breaking changes** - 0ms delay is imperceptible (~1-4ms actual delay)
- ✅ **No child component changes needed** - fix is transparent
- ✅ **Future-proof** - new components automatically benefit
- ✅ **Eliminates code duplication** - no need for setTimeout workarounds in child components

**Affected Components (Now Working Without Workarounds):**
- PurchaseOrderItem (create/edit)
- ReceiveNoteItem (create/edit)
- SalesOrderItem (create/edit)
- All inventory forms with product/SKU selection
- All POS forms with product selection
- Any future forms using SelectableControl with typeahead

**Technical Details:**
The `setTimeout(() => {}, 0)` pattern:
- Pushes callback to macrotask queue
- Allows current call stack and CD cycle to complete
- Executes on next event loop tick
- Triggers new CD cycle with changes in correct order
- Standard Angular pattern for deferring work that would violate unidirectional data flow

**Testing:**
- ✅ Create/edit forms with SKU selection
- ✅ Repeatable forms with auto-calculation
- ✅ Typeahead search and selection
- ✅ Two-way binding with signals and effects
- ✅ No console errors
- ✅ No performance degradation

**References:**
- Analysis: `/docs/EXPRESSION_CHANGED_ERROR_ANALYSIS.md`
- Core Fix Details: `/docs/CORE_FIX_SELECTABLE_CONTROL.md`
- Related Issue: Angular NG0100 - ExpressionChangedAfterItHasBeenCheckedError

**Migration Notes:**
- No migration needed - fix is transparent to consumers
- Child components with setTimeout workarounds can remove them (already handled at core)
- Existing functionality preserved exactly

---

## Template for Future Entries

```markdown
### [Added/Changed/Deprecated/Removed/Fixed/Security]

#### Brief Title
**Date:** YYYY-MM-DD
**File(s):** `path/to/file.ts`
**Issue:** Brief description of problem or feature

**Changes Made:**
- Bullet point list of changes
- Include line numbers if relevant
- Mention breaking changes clearly

**Impact:**
- Who is affected
- What changes in behavior
- Migration steps if needed

**Testing:**
- How to verify the fix/feature works
- Key test cases

**References:**
- Links to related docs/issues
- Related PRs or commits
```

---

## Guidelines for Changelog Updates

### When to Update
- **Every commit** that changes public API
- **Bug fixes** that affect behavior
- **Performance improvements** that are measurable
- **Breaking changes** (always document)
- **New features** or components
- **Deprecations** or removals

### What NOT to Include
- Internal refactoring with no external impact
- Documentation-only changes (unless API docs)
- Test-only changes
- Build configuration changes
- Development dependency updates

### Format Rules
1. **Group by type**: Added, Changed, Deprecated, Removed, Fixed, Security
2. **Include date** for traceability
3. **Mention files** for easy navigation
4. **Explain WHY** not just what
5. **Document impact** on consumers
6. **Provide migration** steps for breaking changes
7. **Reference issues** or related docs

### Example Categories

#### Added
- New components, directives, pipes
- New public methods or properties
- New features or capabilities

#### Changed
- Modifications to existing behavior
- Performance improvements
- API signature changes

#### Deprecated
- Features marked for future removal
- Include removal timeline
- Suggest alternatives

#### Removed
- Deleted features or APIs
- Must include migration path

#### Fixed
- Bug fixes
- Error corrections
- Performance issues resolved

#### Security
- Security patches
- Vulnerability fixes
- Security-related improvements

---

## Version History

### How to Version

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backwards-compatible
- **PATCH** (0.0.X): Bug fixes, backwards-compatible

### When to Release
- Accumulate changes in `[Unreleased]` section
- When ready to release, move to versioned section
- Update version in `package.json`
- Tag commit with version number

---

## Notes

This changelog was started on 2026-01-30 to track changes to the @cartesianui/common library. All significant changes will be documented here moving forward.

For questions or clarifications about any change, refer to:
- The referenced documentation files
- Git commit history
- Related issue trackers
- Code comments in changed files
