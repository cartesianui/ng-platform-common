import { Pipe, PipeTransform } from '@angular/core';
import { DatetimeService } from '../services';

/**
 * Tell the duration since a given time
 * 
 * USAGE:
 * 
 * {{ '2020-11-28T07:47:39.742Z' | timeSince:'days' }} --> 0 years 9 months 1 days
 * {{ '2020-11-28T07:47:39.742Z' | timeSince:'months' }} --> 0 years 9 months
 * {{ '2020-11-28T07:47:39.742Z' | timeSince }} --> 0 years=
 */

@Pipe({
    name: 'timeSince',
    standalone: false
})
export class TimeSincePipe implements PipeTransform {
  transform(value: string, precision: 'years' | 'months' | 'days' = 'years'): string {
    return DatetimeService.timeSince(value, precision);
  }
}
