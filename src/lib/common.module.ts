import { CommonModule as AngularCommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TimeSincePipe, FormatPipe, RegionalCurrencyPipe } from './pipes';

// `RegionalCurrencyPipe` is standalone — consumers import it directly
// from `@cartesianui/common`. Including it in the imports array here
// re-exports it for module-based consumers.
import { BusyDirective, AccessibleDirective, DecimalFormatDirective, FixedPopupPositionDirective } from './directives';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { ModalModule, BsModalService } from 'ngx-bootstrap/modal';
import { AlertModule } from 'ngx-bootstrap/alert';
import { DatetimeService } from './services';
import { LookupWidgetComponent, DefaultActionsComponent, AlertComponent, ConfirmDialogComponent, AppDialogService } from './widgets';
import { BaseComponent } from './base.component';
import {
  RepeatableFormControlsComponent, RepeatableFormBaseComponent, RepeatableDirective,
  ConfigurableFormComponent, ConfigurableFieldDirective, ButtonComponent, InputComponent, SelectComponent,
  NoWhiteSpaceValidator,
  EqualValidator,
  EmailValidator,
  DomainValidator,
  DateValidator,
  AgeValidator,
  InCollectionValidator,
  NotInCollectionValidator,
  FloatValidator,
  UnicodeValidator,
  NumericValidator,
  ValidateDirective,
  WithValidationComponent,
  ValidationService,
  RequireRelativeValidator
} from './form'

const VALIDATION_DIRECTIVES = [
  NoWhiteSpaceValidator,
  EqualValidator,
  EmailValidator,
  DomainValidator,
  DateValidator,
  AgeValidator,
  InCollectionValidator,
  NotInCollectionValidator,
  FloatValidator,
  UnicodeValidator,
  NumericValidator,
  ValidateDirective,
  WithValidationComponent,
  RequireRelativeValidator
];
const FORM_COMPONENTS = [ConfigurableFormComponent, ButtonComponent, InputComponent, SelectComponent, ConfigurableFieldDirective];
// `AlertComponent` is NOT here: it went standalone 2026-09-01 so standalone screens could use
// it, and a standalone component is imported, never declared. It stays exported below, so all
// 25 existing `<app-alert>` template usages are unaffected.
const WIDGET_COMPONENTS = [LookupWidgetComponent, DefaultActionsComponent, ConfirmDialogComponent];
const COMMON_COMPONENTS = [
  BaseComponent, 
  RepeatableFormControlsComponent, 
  RepeatableFormBaseComponent, 
  RepeatableDirective, 
  ...FORM_COMPONENTS, 
  ...WIDGET_COMPONENTS, 
  ...VALIDATION_DIRECTIVES
] as any;

@NgModule({
  imports: [
    AngularCommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TypeaheadModule,
    BsDatepickerModule,
    ModalModule.forRoot(),
    AlertModule.forRoot(),
    NgxDatatableModule,
    RegionalCurrencyPipe,
    FixedPopupPositionDirective,
    AccessibleDirective,
    AlertComponent,
  ],
  // `AccessibleDirective` moved to `imports`: it is standalone as of 2026-09-01 so that
  // standalone components can gate on it, and a standalone directive is imported, never declared.
  declarations: [TimeSincePipe, FormatPipe, BusyDirective, DecimalFormatDirective, ...COMMON_COMPONENTS],
  exports: [TimeSincePipe, FormatPipe, RegionalCurrencyPipe, BusyDirective, AccessibleDirective, DecimalFormatDirective, FixedPopupPositionDirective, AlertComponent, ...COMMON_COMPONENTS]
})
export class CommonModule {
  static forRoot(): ModuleWithProviders<CommonModule> {
    return {
      ngModule: CommonModule,
      providers: [DatetimeService, ValidationService, BsModalService, AppDialogService]
    };
  }
  static forFeature(): ModuleWithProviders<CommonModule> {
    return {
      ngModule: CommonModule,
      providers: [DatetimeService, ValidationService, BsModalService, AppDialogService]
    };
  }
}
