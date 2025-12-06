import { CommonModule as AngularCommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TimeSincePipe, FormatPipe } from './pipes';
import { BusyDirective, AccessibleDirective } from './directives';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { DatetimeService } from './services';
import { LookupWidgetComponent, DefaultActionsComponent } from './widgets';
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
const WIDGET_COMPONENTS = [LookupWidgetComponent, DefaultActionsComponent];
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
  imports: [AngularCommonModule, RouterModule, FormsModule, ReactiveFormsModule, TypeaheadModule, BsDatepickerModule, NgxDatatableModule],
  declarations: [TimeSincePipe, FormatPipe, BusyDirective, AccessibleDirective, ...COMMON_COMPONENTS],
  exports: [TimeSincePipe, FormatPipe, BusyDirective, AccessibleDirective, ...COMMON_COMPONENTS]
})
export class CommonModule {
  static forRoot(): ModuleWithProviders<CommonModule> {
    return {
      ngModule: CommonModule,
      providers: [DatetimeService, ValidationService]
    };
  }
  static forFeature(): ModuleWithProviders<CommonModule> {
    return {
      ngModule: CommonModule,
      providers: [DatetimeService, ValidationService]
    };
  }
}
