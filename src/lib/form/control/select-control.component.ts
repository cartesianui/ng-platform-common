import {
  Component,
  ChangeDetectionStrategy,
  signal,
  input,
  forwardRef,
  inject,
  ElementRef,
  HostListener,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

/**
 * select-control — a lightweight, fully-themed single-select dropdown.
 *
 * Why this exists: native `<select>` option lists are OS-rendered and can't be
 * themed (hover bar stays the browser blue), while `selectable-control` is a
 * heavy typeahead (async URL fetch, multi-select, criteria building) — overkill
 * for a small static option set. This control renders its own option list so it
 * matches the form theme (surface bg, primary active row, padding/fonts) and
 * stays minimal: static `[options]`, a ControlValueAccessor, open-on-click.
 *
 * Emits the option's `optionKey` value (like a native <select>), so it's a
 * drop-in for `[ngModel]`/`formControlName` bindings that expected a string.
 */
@Component({
  selector: 'select-control',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectControlComponent),
      multi: true
    }
  ],
  template: `
    <div
      class="select-control"
      [class.sc--open]="open()"
      [class.sc--readonly]="readonly() || disabled()"
    >
      <div
        class="form-control sc-trigger"
        role="combobox"
        tabindex="0"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
        (keydown)="onKeydown($event)"
      >
        <span class="sc-label" [class.sc-placeholder]="!selectedOption()">
          {{ selectedLabel() || placeholder() }}
        </span>
        <button
          *ngIf="clearable() && selectedOption() && !readonly() && !disabled()"
          type="button"
          class="sc-clear"
          aria-label="Clear"
          (click)="clear($event)"
        >&times;</button>
        <i class="sc-chevron"></i>
      </div>

      <ul *ngIf="open()" class="sc-menu" role="listbox">
        <li
          *ngFor="let o of options(); let i = index"
          class="sc-option"
          role="option"
          [class.sc-option--active]="i === activeIndex()"
          [class.sc-option--selected]="keyOf(o) === value()"
          [attr.aria-selected]="keyOf(o) === value()"
          (click)="select(o)"
          (mouseenter)="activeIndex.set(i)"
        >
          {{ labelOf(o) }}
        </li>
        <li *ngIf="!options()?.length" class="sc-empty">No options</li>
      </ul>
    </div>
  `,
  styles: [
    `
      .select-control {
        position: relative;
        width: 100%;
      }

      /* Trigger reuses .form-control for surface/border/radius/padding + the
         global themed focus ring (it's focusable via tabindex). */
      .sc-trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        cursor: pointer;
      }
      .sc--readonly .sc-trigger {
        cursor: not-allowed;
        background-color: var(--cui-secondary-bg);
      }

      .sc-label {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ct-text, inherit);
      }
      .sc-placeholder {
        color: var(--ct-text-faint, #9298ad);
      }

      .sc-clear {
        flex: none;
        border: 0;
        background: transparent;
        color: var(--ct-text-faint, #9298ad);
        font-size: 1.15rem;
        line-height: 1;
        padding: 0 0.15rem;
        cursor: pointer;
      }
      .sc-clear:hover {
        color: var(--ct-text);
      }

      /* CSS chevron — follows the theme text colour, rotates when open */
      .sc-chevron {
        flex: none;
        width: 0.55rem;
        height: 0.55rem;
        margin-left: auto;
        border-right: 2px solid var(--ct-text-muted, #6c757d);
        border-bottom: 2px solid var(--ct-text-muted, #6c757d);
        transform: rotate(45deg) translate(-2px, -2px);
        transition: transform 0.15s ease;
      }
      .sc--open .sc-chevron {
        transform: rotate(-135deg);
      }

      /* Option list — matches the typeahead dropdown look (surface, primary
         active row, padding/fonts). Token-driven, so admin indigo / care teal
         both apply automatically, light + dark. */
      .sc-menu {
        position: absolute;
        z-index: 1080;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        margin: 0;
        padding: 0.25rem;
        list-style: none;
        max-height: 260px;
        overflow-y: auto;
        background-color: var(--ct-surface);
        border: 1px solid var(--ct-border);
        border-radius: var(--cui-border-radius);
        box-shadow: 0 0.5rem 1.5rem -0.5rem rgba(0, 0, 0, 0.25);
      }
      .sc-option {
        padding: 0.5rem 0.65rem;
        border-radius: calc(var(--cui-border-radius) - 2px);
        font-size: 0.875rem;
        color: var(--ct-text);
        cursor: pointer;
      }
      .sc-option--active {
        background-color: var(--ct-surface-3);
      }
      .sc-option--selected {
        background-color: var(--ct-primary);
        color: var(--ct-on-primary);
      }
      .sc-option--selected.sc-option--active {
        background-color: var(--ct-primary-hover);
      }
      .sc-empty {
        padding: 0.5rem 0.65rem;
        font-size: 0.875rem;
        color: var(--ct-text-faint, #9298ad);
      }
    `
  ]
})
export class SelectControlComponent implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  /** Static option objects, e.g. `[{ value, name }]` (enum meta `getOptions()`). */
  options = input<any[]>([]);
  /** Property read for the emitted value. Default `value`. */
  optionKey = input<string>('value');
  /** Property read for the displayed label. Default `name`. */
  optionField = input<string>('name');
  placeholder = input<string>('Select...');
  readonly = input<boolean>(false);
  /** Show an `×` to reset the value to null. Default true. */
  clearable = input<boolean>(true);

  open = signal(false);
  value = signal<any>(null);
  disabled = signal(false);
  activeIndex = signal<number>(-1);

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};

  selectedOption = computed(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '') return null;
    return (this.options() ?? []).find((o) => this.keyOf(o) === v) ?? null;
  });
  selectedLabel = computed(() => {
    const o = this.selectedOption();
    return o ? this.labelOf(o) : '';
  });

  keyOf(o: any): any {
    // Support both object options ({ value, name }) and plain string options.
    return o !== null && typeof o === 'object' ? o[this.optionKey()] : o;
  }
  labelOf(o: any): string {
    if (o !== null && typeof o === 'object') {
      return o[this.optionField()] ?? o.name ?? o.label ?? '';
    }
    return o == null ? '' : String(o);
  }

  toggle(): void {
    if (this.readonly() || this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) {
      const opts = this.options() ?? [];
      this.activeIndex.set(opts.findIndex((o) => this.keyOf(o) === this.value()));
    }
  }
  close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  select(o: any): void {
    const key = this.keyOf(o);
    this.value.set(key);
    this.onChange(key);
    this.onTouched();
    this.close();
  }
  clear(ev: Event): void {
    ev.stopPropagation();
    this.value.set(null);
    this.onChange(null);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.close();
  }

  onKeydown(ev: KeyboardEvent): void {
    if (this.readonly() || this.disabled()) return;
    const opts = this.options() ?? [];
    if (!this.open()) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        this.toggle();
      }
      return;
    }
    switch (ev.key) {
      case 'Escape':
        ev.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        ev.preventDefault();
        this.activeIndex.update((i) => Math.min(i + 1, opts.length - 1));
        break;
      case 'ArrowUp':
        ev.preventDefault();
        this.activeIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        ev.preventDefault();
        const o = opts[this.activeIndex()];
        if (o) this.select(o);
        break;
      }
    }
  }

  // ── ControlValueAccessor ─────────────────────────────────────────────
  writeValue(v: any): void {
    this.value.set(v ?? null);
  }
  registerOnChange(fn: (v: any) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }
}
