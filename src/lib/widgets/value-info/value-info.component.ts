import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * One row per supported value in the bound `map`. Tone drives the
 * Bootstrap alert color; icon defaults per tone if not supplied.
 */
export interface ValueInfo {
  tone: 'info' | 'success' | 'warning' | 'danger' | 'secondary';
  text: string;
  icon?: string;
}

const DEFAULT_ICONS: Record<ValueInfo['tone'], string> = {
  info: 'fa-info-circle',
  success: 'fa-check-circle',
  warning: 'fa-exclamation-triangle',
  danger: 'fa-exclamation-circle',
  secondary: 'fa-circle-info',
};

/**
 * Reactive info box driven by a bound value.
 *
 * Use whenever a form control's selected value carries information the user
 * should see *before* saving — a status with downstream consequences, a
 * payment method that changes the next step, a role that grants permissions,
 * any keyed-message-per-value pattern.
 *
 * The component is domain-agnostic. The consumer supplies the `map`, keyed
 * by value, returning `{ tone, text, icon? }`. The component renders a
 * Bootstrap alert that swaps as the value changes.
 *
 * @example
 *   <value-info
 *     [value]="formGroup.get('status')?.value"
 *     [map]="StatusInfoMap"
 *   ></value-info>
 */
@Component({
  selector: 'value-info',
  templateUrl: './value-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class ValueInfoComponent {
  readonly value = input<string | number | null | undefined>(undefined);
  readonly map = input.required<Record<string | number, ValueInfo>>();

  protected readonly entry = computed<ValueInfo | null>(() => {
    const v = this.value();
    if (v === null || v === undefined) return null;
    return this.map()[v as string | number] ?? null;
  });

  protected readonly icon = computed<string>(() => {
    const e = this.entry();
    if (!e) return '';
    return e.icon ?? DEFAULT_ICONS[e.tone];
  });
}
