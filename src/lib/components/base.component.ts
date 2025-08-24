import { Injector, ElementRef, OnDestroy, Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import {
  AppConstants,
  LocalizationService,
  PermissionCheckerService,
  FeatureCheckerService,
  NotifyService,
  SettingService,
  MessageService,
  TenancyService,
  UiService,
  SessionService,
  HttpNotificationService
} from '@cartesianui/core';
import { ValidationService } from '../form/validation';
import { ChildComponent, ChildComponentSelected } from './base.types';
import { isEqual } from 'lodash';

@Component({
  template: ''
})
export abstract class BaseComponent<TChildComponent extends ChildComponent = {}> implements OnDestroy {
  localizationSourceName = AppConstants.localization.defaultLocalizationSourceName;

  localization: LocalizationService;
  permissionCheckerService: PermissionCheckerService;
  feature: FeatureCheckerService;
  notify: NotifyService;
  ui: UiService;
  setting: SettingService;
  message: MessageService;
  tenancy: TenancyService;
  appSession: SessionService;
  elementRef: ElementRef;
  subscriptions: Array<Subscription> = [];
  formValidator: ValidationService;
  titleService: Title;
  router: Router;
  route: ActivatedRoute;
  _location: Location; // underscrore to get rid if some conflict from some other model/class wth same name
  errorService: HttpNotificationService;

  childComponents: TChildComponent;
  childComponentSelected: ChildComponentSelected<TChildComponent> | false = false;
  childSelected: boolean = false;
  selectedChildKey: keyof TChildComponent | null = null;

  constructor(injector: Injector) {
    this.localization = injector.get(LocalizationService);
    this.permissionCheckerService = injector.get(PermissionCheckerService);
    this.feature = injector.get(FeatureCheckerService);
    this.notify = injector.get(NotifyService);
    this.ui = injector.get(UiService);
    this.setting = injector.get(SettingService);
    this.message = injector.get(MessageService);
    this.tenancy = injector.get(TenancyService);
    this.appSession = injector.get(SessionService);
    this.formValidator = injector.get(ValidationService);
    this.elementRef = injector.get(ElementRef);
    this.titleService = injector.get(Title);
    this.router = injector.get(Router);
    this.route = injector.get(ActivatedRoute);
    this._location = injector.get(Location);
    this.errorService = injector.get(HttpNotificationService);
  }

  ngOnDestroy(): void {
    this.removeSubscriptions();
  }

  isGranted(permissionName: string): boolean {
    return this.permissionCheckerService.isGranted(permissionName);
  }

  protected removeSubscriptions() {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }

  isComponentSelected(component: ChildComponentSelected<TChildComponent>): boolean {
    // console.log(this.childSelected, isEqual(this.childComponentSelected, component), component);
    if (this.childSelected && isEqual(this.childComponentSelected, component)) {
      return true;
    }
    return false;
  }

  showChildComponent(component: ChildComponentSelected<TChildComponent>, key: keyof TChildComponent): void {
    this.childSelected = true;
    this.childComponentSelected = component;
    this.selectedChildKey = key;
  }

  hideChildComponent(visible): void {
    if (visible === false) {
      this.childSelected = false;
      this.childComponentSelected = false;
      this.selectedChildKey = null;
    }
  }
}
