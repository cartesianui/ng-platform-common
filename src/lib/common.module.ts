import { CommonModule as AngularCommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TimeSincePipe, FormatPipe } from './pipes';
import { BusyDirective, AccessibleDirective } from './directive';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { DatetimeService } from './services';
import { LookupWidgetComponent, DefaultActionsComponent } from './widgets';
import { BaseComponent, RepeaterControlsComponent, RepeatableControlsComponent, RepeaterItemDirective } from './components';
import { ConfigurableFormComponent } from './form/configurable/configurable-form.component';
import { ButtonComponent } from './form/configurable/elements/button/button.component';
import { InputComponent } from './form/configurable/elements/input/input.component';
import { SelectComponent } from './form/configurable/elements/select/select.component';
import { ConfigurableFieldDirective } from './form/configurable/directives/configurable-field.directive';

import {
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
} from './form/validation';

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
  RepeaterControlsComponent, 
  RepeatableControlsComponent, 
  RepeaterItemDirective, 
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
