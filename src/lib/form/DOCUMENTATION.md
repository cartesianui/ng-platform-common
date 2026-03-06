# Form Module

Form infrastructure for CartesianUI. Provides a base component for create/edit pages, validation system, reusable form controls, and a configurable form builder.

## File Structure

```
form/
  form-base.component.ts           # Abstract base for all create/edit forms
  validation/
    validation.service.ts           # Validator functions + error message resolution
    validation.types.ts             # Error type constants and message templates
    directive/
      validate.directive.ts         # Marks a control for validation display
      validators.directive.ts       # Template-driven validator directives
    component/
      with-validation.component.ts  # Wrapper that displays validation errors
  control/
    boolean-control.component.ts    # Yes/No radio buttons
    switch-control.component.ts     # Bootstrap toggle switch
    toogle-control.component.ts     # Button-style toggle
    selectable-control.component.ts # Searchable dropdown (local + remote)
    choosable-control.component.ts  # Radio/checkbox grid
    upload-control.component.ts     # File upload with drag-drop
  repeatable/
    repeatable.directive.ts         # Marker directive for repeatable items
    repeatable-form-base.component.ts    # Base class for individual item forms
    repeatable-from-controls.component.ts # Container managing array of items
  configurable/
    configurable-form.component.ts  # Schema-driven form builder
    directives/
      configurable-field.directive.ts # Dynamic component loader per field type
    elements/
      input/input.component.ts      # Configurable text input
      select/select.component.ts    # Configurable select dropdown
      button/button.component.ts    # Configurable form button
    models/                         # Interfaces for configurable forms
  index.ts                          # Barrel exports
```

---

## FormBaseComponent

Abstract base class that all create and edit forms extend. Bridges the model's `toForm()` / `fromForm()` methods with Angular reactive forms.

### Setup

```typescript
@Component({
  selector: 'admin-product-create',
  templateUrl: 'create.component.html',
  imports: [...FORM_IMPORTS],
  providers: [{ provide: ENTITY_CONSTRUCTOR, useValue: Product }],
  standalone: true
})
export class ProductCreateComponent extends FormBaseComponent<Product> {
  sb = inject(CatalogSandbox);

  constructor() {
    super(Product);
    this.initForm();   // Creates empty FormGroup from Product model
  }

  onSave(): void {
    if (!this.formGroup.valid) return;
    const entity = this.getEntityFromForm();
    this.sb.product.create(entity);
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `formGroup` | `FormGroup` | The reactive form instance |
| `formContainer` | `ElementRef` | Reference for busy state overlay |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `created` | `EventEmitter<T \| boolean>` | Emitted after successful create |
| `updated` | `EventEmitter<T \| boolean>` | Emitted after successful update |

### Methods

| Method | Description |
|--------|-------------|
| `initForm()` | Creates FormGroup from entity's `toForm()` |
| `getEntityFromForm(formGroup?)` | Converts FormGroup → entity via `fromForm()` |
| `getFormFromEntity(entity?)` | Converts entity → FormGroup (for edit patching) |
| `handleFormBusyState(state, element?)` | Shows/hides loading state based on RequestState |

### Create vs Edit Pattern

**Create** — empty form, save dispatches `create`:

```typescript
export class ProductCreateComponent extends FormBaseComponent<Product> {
  constructor() {
    super(Product);
    this.initForm();
  }

  onSave(): void {
    const entity = this.getEntityFromForm();
    this.sb.product.create(entity);
  }
}
```

**Edit** — watch selected entity, patch form, save dispatches `update`:

```typescript
export class ProductEditComponent extends FormBaseComponent<Product> {
  constructor() {
    super(Product);
    this.initForm();
  }

  private readonly selectEffect = effect(() => {
    const selected = this.sb.product.selected();
    if (!selected) return;
    const formValues = this.getFormFromEntity(selected);
    this.formGroup.patchValue(formValues.value);
  });

  onSave(): void {
    const entity = this.getEntityFromForm();
    this.sb.product.update(this.sb.product.selected()?.id, entity);
  }
}
```

---

## Validation

### WithValidationComponent

Wraps a form control and displays validation error messages below it.

```html
<with-validation [controlName]="'Email Address'">
  <input
    type="email"
    formControlName="email"
    validate
    class="form-control"
    placeholder="Enter email"
  />
</with-validation>
```

The `validate` directive marks the control for error tracking. The optional `controlName` provides a human-readable name for error messages (e.g. "Email Address is required" instead of "email is required").

### Template-Driven Validator Directives

| Directive | Usage | Example |
|-----------|-------|---------|
| `[noWhiteSpace]` | Reject whitespace-only | `<input noWhiteSpace>` |
| `[equalTo]` | Match another field | `<input equalTo="password" reverse="true">` |
| `[requireRelative]` | Required if related field is filled | `<input requireRelative="otherField">` |
| `[email]` | Email format | `<input email>` |
| `[domainName]` | Domain format | `<input domainName>` |
| `[date]` | Date range | `<input date minDate="2020-01-01">` |
| `[age]` | Age range | `<input age="18\|65">` |
| `[inCollection]` | Value must be in set | `<input inCollection="a,b,c">` |
| `[notInCollection]` | Value must not be in set | `<input notInCollection="banned">` |
| `[float]` | Decimal number | `<input float="2">` (max 2 decimals) |
| `[unicode]` | Unicode characters | `<input unicode>` |
| `[numeric]` | Numeric only | `<input numeric>` |

### ValidationService

Programmatic validators for reactive forms:

```typescript
const vs = inject(ValidationService);

// Use in FormControl validators
new FormControl('', [vs.emailValidator()]);
new FormControl('', [vs.dobValidator(18)]);  // min age 18
new FormControl('', [vs.inValidator(['active', 'disabled'])]);
new FormControl('', [vs.confirmPasswordValidator('password')]);

// CSS class helper for styling
vs.getFormClasses(control);  // returns 'is-valid', 'is-invalid', or ''
```

---

## Form Controls

All controls implement `ControlValueAccessor` — they work with both `formControlName` and `[(ngModel)]`.

### BooleanControlComponent

Yes/No radio buttons.

```html
<boolean-control
  formControlName="isActive"
  [yesLabel]="'Enable'"
  [noLabel]="'Disable'"
  [numeric]="true"
></boolean-control>
```

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `yesLabel` | `string` | `'Yes'` | Label for true option |
| `noLabel` | `string` | `'No'` | Label for false option |
| `numeric` | `boolean` | `false` | Write `1`/`0` instead of `true`/`false` |

### SwitchControlComponent

Bootstrap toggle switch.

```html
<switch-control formControlName="manageInventory" label="Track Inventory"></switch-control>
```

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `label` | `string` | `'Switch'` | Toggle label |
| `numeric` | `boolean` | `false` | Write `1`/`0` instead of `true`/`false` |

### ChoosableControlComponent

Renders options as checkboxes (multi) or radio buttons (single) in a grid.

```html
<choosable-control
  formControlName="type"
  [options]="Product.getTypeOptions()"
  optionKey="value"
  optionField="name"
  [cols]="3"
></choosable-control>
```

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `options` | `T[]` | `null` | Local options array |
| `url` | `string` | `null` | API endpoint for options |
| `optionKey` | `string` | `'id'` | Property for option value |
| `optionField` | `string` | `'name'` | Property for display label |
| `multi` | `boolean` | `false` | Multi-select (checkboxes) vs single (radio) |
| `cols` | `number` | `1` | Grid columns |
| `ignoreOptions` | `T[]` | `[]` | Options to exclude |

### SelectableControlComponent

Searchable dropdown with support for local and remote data sources.

```html
<!-- Local options -->
<selectable-control
  formControlName="categoryId"
  [options]="categories"
  optionKey="id"
  optionField="name"
  placeholder="Select category"
></selectable-control>

<!-- Remote options (API search) -->
<selectable-control
  formControlName="vendorId"
  [optionsUrl]="'/api/vendors'"
  [getByIdUrl]="'/api/vendors'"
  optionKey="id"
  optionField="vendorName"
  placeholder="Search vendors..."
></selectable-control>

<!-- Multi-select -->
<selectable-control
  formControlName="tags"
  [options]="allTags"
  optionKey="id"
  optionField="name"
  [multi]="true"
></selectable-control>
```

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `options` | `T[]` | `null` | Local options array |
| `optionsUrl` | `string` | `null` | API endpoint for search |
| `getByIdUrl` | `string` | `null` | API endpoint for single item lookup |
| `optionKey` | `string` | `'id'` | Property for option value |
| `optionField` | `string` | `'name'` | Property for display label |
| `multi` | `boolean` | `false` | Allow multiple selections |
| `placeholder` | `string` | `'Search...'` | Input placeholder |
| `readonly` | `boolean` | `false` | Disable input |
| `allowFreeText` | `boolean` | `false` | Allow custom text entry |
| `ignoreOptions` | `T[]` | `[]` | Options to exclude |

| Output | Description |
|--------|-------------|
| `valueChange` | Emits selected value(s) |
| `entityChange` | Emits full selected object(s) |
| `freeTextChange` | Emits custom text (when `allowFreeText`) |

### FileUploaderComponent

File upload with drag-and-drop, progress tracking, and S3 signed URL support.

```html
<file-uploader
  [signedUrl]="uploadUrl"
  accept="image/*"
  (uploadComplete)="onUploadComplete($event)"
  (uploadProgress)="progress = $event"
></file-uploader>
```

| Input | Type | Description |
|-------|------|-------------|
| `signedUrl` | `string` | Direct S3 signed PUT URL |
| `getSignedUrl` | `(file) => Promise<string>` | Function to get URL per file |
| `uploadFn` | `UploadFunction` | Custom upload function |
| `accept` | `string` | File type filter (e.g. `'image/*'`) |
| `multiple` | `boolean` | Allow multiple files |
| `maxSizeBytes` | `number` | Max file size |

| Output | Type | Description |
|--------|------|-------------|
| `uploadComplete` | `UploadResult` | `{ success, status, location?, error? }` |
| `uploadProgress` | `number` | 0–100 percent |

---

## Repeatable Forms

For managing arrays of entities in forms (e.g. order line items, prescription items).

### RepeatableFormControlsComponent

Container component that manages add/remove and renders each item via content projection.

```html
<repeatable-form [data]="orderLines" (dataChange)="orderLines = $event">
  <ng-template let-item let-i="index" let-onChange="onChange">
    <line-item-form
      [data]="item"
      [index]="i"
      (dataChange)="onChange($event)"
    ></line-item-form>
  </ng-template>
</repeatable-form>
```

| Input | Type | Description |
|-------|------|-------------|
| `data` | `T[]` | Array of items |
| `showSaveButton` | `boolean` | Show per-item save button |

| Output | Description |
|--------|-------------|
| `dataChange` | Emits updated array on add/remove/update |

### RepeatableFormBaseComponent

Base class for individual item forms within a repeatable container.

```typescript
@Component({
  selector: 'line-item-form',
  templateUrl: 'line-item-form.component.html'
})
export class LineItemFormComponent extends RepeatableFormBaseComponent<LineItem> {
  constructor() {
    super(LineItem);
    this.initForm();
  }
}
```

Inputs: `data` (the item), `index`. Output: `dataChange` (emits updated item).

---

## Configurable Forms

Schema-driven form builder for dynamic form generation from configuration objects.

### ConfigurableFormComponent

```html
<configurable-form
  [config]="formConfig"
  (submitted)="onSubmit($event)"
></configurable-form>
```

### IFormField Interface

```typescript
{
  name: string;                 // FormGroup control name
  type: string;                 // 'input' | 'select' | 'button'
  label?: string;
  inputType?: string;           // HTML input type: 'text', 'email', 'password', etc.
  placeholder?: string;
  value?: any;                  // Default value
  validators?: ValidatorFn[];
  options?: { name, value }[];  // For select fields
  disabled?: boolean;
  hidden?: boolean;
  classes?: string;             // CSS classes
  prependIcon?: string;         // Font Awesome class
  appendIcon?: string;
  invalidMessage?: string;
  onClick?: (event) => void;
  onChange?: (event) => void;
}
```

### Example Config

```typescript
formConfig: IFormField[] = [
  {
    name: 'email',
    type: 'input',
    inputType: 'email',
    label: 'Email Address',
    placeholder: 'Enter email',
    validators: [Validators.required, Validators.email],
    prependIcon: 'fa fa-envelope'
  },
  {
    name: 'role',
    type: 'select',
    label: 'Role',
    placeholder: 'Select role',
    options: [
      { name: 'Admin', value: 'admin' },
      { name: 'User', value: 'user' }
    ]
  },
  {
    name: 'submit',
    type: 'button',
    label: 'Save',
    classes: 'btn btn-primary'
  }
];
```

---

## Integration with Models

The form system integrates with the model layer through the `IHasForm` interface:

```
Entity Model (with @EntityMeta form fields)
    ↓
model.toForm()  →  FormGroup with validators and formatted values
    ↓
FormBaseComponent.initForm() stores it as this.formGroup
    ↓
User interacts with form
    ↓
model.fromForm(formGroup)  →  Entity instance with DB-formatted values
    ↓
EntitySandbox.create(entity) or EntitySandbox.update(id, entity)
```

The `ENTITY_CONSTRUCTOR` injection token provides the model class to `FormBaseComponent`:

```typescript
providers: [{ provide: ENTITY_CONSTRUCTOR, useValue: Product }]
```
