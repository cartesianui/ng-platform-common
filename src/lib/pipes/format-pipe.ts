import { Pipe, PipeTransform } from '@angular/core';
import { DatetimeService, DateFormat } from '../services';

@Pipe({
    name: 'format',
    standalone: false
})
export class FormatPipe implements PipeTransform {
  transform(value: string, type: string): string {
    switch (type) {
      case 'date':
        return DatetimeService.fromSql(value);
      default:
        return value;
    }
  }
}