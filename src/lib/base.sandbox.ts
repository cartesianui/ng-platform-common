import { inject, Injector } from '@angular/core';
import { SessionService, localeDateString } from '@cartesianui/core';

export abstract class Sandbox {

  protected injector = inject(Injector);
  protected _sessionService = inject(SessionService);

  public culture: string;

  constructor() {}

  /**
   * Formats date string based on selected culture
   *
   * @param string value date string to be formatted
   */
  public formatDate(value: string) {
    return localeDateString(value, this.culture);
  }
}
