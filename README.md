# @cartesianui/common

Shared platform library for CartesianUI Angular applications. Provides base classes, utilities, and infrastructure that all feature libraries build on.

## Modules

| Module | Description | Docs |
|--------|-------------|------|
| [Models](src/lib/models/) | Entity definition, decorators (`@EntityMeta`, `@ListMeta`, `@FormMeta`), form binding, datatable formatting, value display | [DOCUMENTATION.md](src/lib/models/DOCUMENTATION.md) |
| [Store](src/lib/store/) | NgRx state management — entity actions, reducer, effects factories, `EntitySandbox` | [DOCUMENTATION.md](src/lib/store/DOCUMENTATION.md) |
| [Form](src/lib/form/) | Form infrastructure — `FormBaseComponent`, validation, reusable controls, repeatable forms, configurable form builder | [DOCUMENTATION.md](src/lib/form/DOCUMENTATION.md) |
| [Datatable](src/lib/datatable/) | Listing infrastructure — `ListingControlsComponent`, `AppDatatableComponent` wrapper, column/detail directives | [DOCUMENTATION.md](src/lib/datatable/DOCUMENTATION.md) |
| [Directives](src/lib/directives/) | Shared directives (busy overlay, etc.) | — |
| [Pipes](src/lib/pipes/) | Shared pipes | — |
| [Services](src/lib/services/) | Shared services | — |
| [Widgets](src/lib/widgets/) | Reusable UI widgets | — |
| [Helpers](src/lib/helpers/) | Utility functions | — |
| [Animations](src/lib/animations/) | Shared Angular animations | — |

## How Modules Connect

```
Models (@EntityMeta)
  ├── defines form fields    → Form (FormBaseComponent.initForm())
  ├── defines datatable cols → Datatable (ListingControlsComponent.loadEntityMetadata())
  └── defines search form    → Datatable (criteria filtering)

Store (EntitySandbox)
  ├── provides entities()    → Datatable (rows)
  ├── provides selected()    → Form (edit patching)
  ├── provides pagination()  → Datatable (paging)
  └── provides requestState  → Form (busy state)
```

## Build

```bash
ng build common
```

## Publishing

```bash
cd dist/common && npm publish
```
