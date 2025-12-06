import { Injector, ElementRef, OnDestroy, Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import {
  AppConfig,
  LocalizationService,
  PermissionCheckerService,
  FeatureCheckerService,
  NotifyService,
  SettingService,
  MessageService,
  TenancyService,
  UiService,
  SessionService,
  HttpErrorService
} from '@cartesianui/core';
import { ValidationService } from './form/validation';
import { ChildComponent, ChildComponentSelected } from './base.types';
import { isEqual } from 'lodash';

@Component({
    template: '',
    standalone: false
})
export abstract class BaseComponent<TChildComponent extends ChildComponent = {}> implements OnDestroy {

  protected injector = inject(Injector);
  protected localization = inject(LocalizationService);
  protected permissionCheckerService = inject(PermissionCheckerService);
  protected feature = inject(FeatureCheckerService);
  protected notify = inject(NotifyService);
  protected ui = inject(UiService);
  protected setting = inject(SettingService);
  protected message = inject(MessageService);
  protected tenancy = inject(TenancyService);
  protected appSession = inject(SessionService);
  protected formValidator = inject(ValidationService);
  protected elementRef = inject(ElementRef);
  protected titleService = inject(Title);
  protected router = inject(Router);
  protected route = inject(ActivatedRoute);
  protected _location = inject(Location);
  protected errorService = inject(HttpErrorService);

  localizationSourceName = AppConfig.localization.defaultLocalizationSourceName;

  // localization: LocalizationService;
  // permissionCheckerService: PermissionCheckerService;
  // feature: FeatureCheckerService;
  // notify: NotifyService;
  // ui: UiService;
  // setting: SettingService;
  // message: MessageService;
  // tenancy: TenancyService;
  // appSession: SessionService;
  // elementRef: ElementRef;
  // formValidator: ValidationService;
  // titleService: Title;
  // router: Router;
  // route: ActivatedRoute;
  // _location: Location; // underscrore to get rid if some conflict from some other model/class wth same name
  // errorService: HttpErrorService;

  subscriptions: Array<Subscription> = [];

  childComponents: TChildComponent;
  childComponentSelected: ChildComponentSelected<TChildComponent> | false = false;
  childSelected: boolean = false;
  selectedChildKey: keyof TChildComponent | null = null;


  constructor() {}
  // constructor(injector: Injector) {
  //   this.localization = injector.get(LocalizationService);
  //   this.permissionCheckerService = injector.get(PermissionCheckerService);
  //   this.feature = injector.get(FeatureCheckerService);
  //   this.notify = injector.get(NotifyService);
  //   this.ui = injector.get(UiService);
  //   this.setting = injector.get(SettingService);
  //   this.message = injector.get(MessageService);
  //   this.tenancy = injector.get(TenancyService);
  //   this.appSession = injector.get(SessionService);
  //   this.formValidator = injector.get(ValidationService);
  //   this.elementRef = injector.get(ElementRef);
  //   this.titleService = injector.get(Title);
  //   this.router = injector.get(Router);
  //   this.route = injector.get(ActivatedRoute);
  //   this._location = injector.get(Location);
  //   this.errorService = injector.get(HttpErrorService);
  // }

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
