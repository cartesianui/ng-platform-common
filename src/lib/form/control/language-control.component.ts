import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  computed,
  OnDestroy
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NgControl,
  FormsModule,
  ReactiveFormsModule,
  FormControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { Observable, Observer, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  countryCode: string;  // ISO 3166-1-alpha-2 for flag-icons CSS class
  direction?: 'ltr' | 'rtl';
}

export type LanguageDisplay = 'flag' | 'code' | 'name' | 'flag+code' | 'flag+name';

/**
 * Default list of common languages. Can be overridden via the `languages` input.
 */
export const DEFAULT_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', countryCode: 'us' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', countryCode: 'pk', direction: 'rtl' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', countryCode: 'sa', direction: 'rtl' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', countryCode: 'in' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', countryCode: 'cn' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', countryCode: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', countryCode: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', countryCode: 'de' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', countryCode: 'pt' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', countryCode: 'ru' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', countryCode: 'jp' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', countryCode: 'kr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', countryCode: 'it' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', countryCode: 'tr' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', countryCode: 'nl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', countryCode: 'pl' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', countryCode: 'se' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', countryCode: 'dk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', countryCode: 'no' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', countryCode: 'fi' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', countryCode: 'th' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', countryCode: 'vn' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', countryCode: 'id' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', countryCode: 'my' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', countryCode: 'bd' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', countryCode: 'in' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', countryCode: 'in' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', countryCode: 'ir', direction: 'rtl' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', countryCode: 'il', direction: 'rtl' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', countryCode: 'gr' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', countryCode: 'cz' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', countryCode: 'ro' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', countryCode: 'hu' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', countryCode: 'ua' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', flag: '🇦🇫', countryCode: 'af', direction: 'rtl' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', countryCode: 'ke' }
];

@Component({
  selector: 'language-control',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TypeaheadModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LanguageSelectComponent),
      multi: true
    }
  ],
  template: `
    <!-- Pills mode: horizontal selectable flags/labels -->
    @if (mode() === 'pills') {
      <div class="language-pills d-flex flex-wrap gap-1">
        @for (lang of languages(); track lang.code) {
          <button type="button"
            class="btn btn-sm"
            [class.btn-primary]="isSelected(lang)"
            [class.btn-outline-secondary]="!isSelected(lang)"
            [disabled]="isDisabled"
            [title]="lang.name"
            (click)="togglePill(lang)">
            @if (pillDisplay() === 'flag') {
              <span [class]="getFlagClass(lang)" style="font-size: 1.25rem;"></span>
            } @else if (pillDisplay() === 'code') {
              {{ lang.code.toUpperCase() }}
            } @else if (pillDisplay() === 'flag+code') {
              <span [class]="getFlagClass(lang)"></span> <span class="ms-1 small">{{ lang.code.toUpperCase() }}</span>
            } @else {
              <span [class]="getFlagClass(lang)"></span> <span class="ms-1 small">{{ lang.name }}</span>
            }
          </button>
        }
      </div>
    } @else {
      <!-- Dropdown mode (default) -->

      <!-- Multi-select: show selected as badges -->
      @if (multi() && selectedLanguages().length > 0) {
        <div class="language-badges mb-1">
          @for (lang of selectedLanguages(); track lang.code) {
            <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 me-1 mb-1 d-inline-flex align-items-center">
              <span [class]="getFlagClass(lang) + ' me-1'"></span>
              {{ formatDisplay(lang) }}
              @if (!isDisabled) {
                <button type="button" class="btn-close btn-close-sm ms-1" style="font-size: 0.6rem;" (click)="removeLanguage(lang)"></button>
              }
            </span>
          }
        </div>
      }

      <!-- Single select: show selected inline -->
      @if (!multi() && selectedLanguages().length > 0 && !isSearching) {
        <div class="d-flex align-items-center form-control cursor-pointer" (click)="startSearch()" [class.disabled]="isDisabled">
          <span [class]="getFlagClass(selectedLanguages()[0]) + ' me-2'"></span>
          <span>{{ formatDisplay(selectedLanguages()[0]) }}</span>
          @if (!isDisabled) {
            <button type="button" class="btn-close btn-close-sm ms-auto" style="font-size: 0.6rem;" (click)="clear($event)"></button>
          }
        </div>
      }

      <!-- Search input -->
      @if (multi() || selectedLanguages().length === 0 || isSearching) {
        <input
          #searchInput
          type="text"
          class="form-control"
          [formControl]="searchControl"
          [placeholder]="placeholder()"
          [typeahead]="filteredLanguages$"
          [typeaheadOptionField]="'searchLabel'"
          [typeaheadMinLength]="0"
          [typeaheadScrollable]="true"
          [typeaheadOptionsInScrollableView]="8"
          (typeaheadOnSelect)="onSelect($event)"
          (blur)="onBlurSearch()"
          [disabled]="isDisabled"
        />
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .language-badges { display: flex; flex-wrap: wrap; }
    .language-pills .btn { min-width: 36px; padding: 0.25rem 0.5rem; transition: all 0.15s ease; }
    .language-pills .btn:hover:not(.btn-primary) { background-color: rgba(var(--cui-primary-rgb, 13,110,253), 0.1); }
    .cursor-pointer { cursor: pointer; }
    .form-control.disabled { background-color: #e9ecef; pointer-events: none; }
  `]
})
export class LanguageSelectComponent implements ControlValueAccessor, OnDestroy {
  // --- Inputs ---
  languages = input<Language[]>(DEFAULT_LANGUAGES);
  display = input<LanguageDisplay>('flag+name');
  mode = input<'dropdown' | 'pills'>('dropdown');
  pillDisplay = input<'flag' | 'code' | 'flag+code' | 'flag+name'>('flag');
  multi = input<boolean>(false);
  placeholder = input<string>('Select language...');
  returnField = input<'code' | 'name' | 'object'>('code');

  // --- Outputs ---
  valueChange = output<any>();

  // --- State ---
  selectedLanguages = signal<Language[]>([]);
  searchControl = new FormControl('');
  isSearching = false;
  isDisabled = false;
  filteredLanguages$!: Observable<(Language & { searchLabel: string })[]>;

  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  private ngControl: NgControl | null = null;
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    queueMicrotask(() => {
      try {
        this.ngControl = this.injector.get(NgControl, null);
        if (this.ngControl) {
          this.ngControl.valueAccessor = this;
        }
      } catch {}
    });

    this.filteredLanguages$ = new Observable((observer: Observer<string>) => {
      observer.next(this.searchControl.getRawValue() || '');
    }).pipe(
      switchMap((query: string) => {
        const selected = new Set(this.selectedLanguages().map(l => l.code));
        const all = this.languages().filter(l => !selected.has(l.code));

        if (!query) return of(all.map(l => ({ ...l, searchLabel: this.formatDisplay(l) })));

        const q = query.toLowerCase();
        return of(
          all
            .filter(l =>
              l.name.toLowerCase().includes(q) ||
              l.nativeName.toLowerCase().includes(q) ||
              l.code.toLowerCase().includes(q)
            )
            .map(l => ({ ...l, searchLabel: this.formatDisplay(l) }))
        );
      })
    );
  }

  getFlagClass(lang: Language): string {
    return `fi fi-${lang.countryCode}`;
  }

  formatDisplay(lang: Language): string {
    const d = this.display();
    switch (d) {
      case 'flag': return lang.flag;
      case 'code': return lang.code.toUpperCase();
      case 'name': return lang.name;
      case 'flag+code': return `${lang.flag} ${lang.code.toUpperCase()}`;
      case 'flag+name': return `${lang.flag} ${lang.name}`;
      default: return lang.name;
    }
  }

  isSelected(lang: Language): boolean {
    return this.selectedLanguages().some(l => l.code === lang.code);
  }

  togglePill(lang: Language): void {
    if (this.isDisabled) return;

    if (this.multi()) {
      // Multi: toggle selection
      if (this.isSelected(lang)) {
        this.selectedLanguages.set(this.selectedLanguages().filter(l => l.code !== lang.code));
      } else {
        this.selectedLanguages.set([...this.selectedLanguages(), lang]);
      }
    } else {
      // Single: select or deselect
      if (this.isSelected(lang)) {
        this.selectedLanguages.set([]);
      } else {
        this.selectedLanguages.set([lang]);
      }
    }

    this.emitValue();
    this.onTouched();
    this.cdr.markForCheck();
  }

  onSelect(event: any): void {
    const item: Language = event.item;
    if (!item) return;

    if (this.multi()) {
      const current = [...this.selectedLanguages(), item];
      this.selectedLanguages.set(current);
      this.searchControl.setValue('', { emitEvent: false });
    } else {
      this.selectedLanguages.set([item]);
      this.isSearching = false;
    }

    this.emitValue();
    this.onTouched();
    this.cdr.markForCheck();
  }

  removeLanguage(lang: Language): void {
    const current = this.selectedLanguages().filter(l => l.code !== lang.code);
    this.selectedLanguages.set(current);
    this.emitValue();
    this.cdr.markForCheck();
  }

  startSearch(): void {
    this.isSearching = true;
    this.searchControl.setValue('', { emitEvent: false });
    this.cdr.markForCheck();
    setTimeout(() => {
      const input = document.querySelector('language-control input') as HTMLInputElement;
      input?.focus();
    });
  }

  onBlurSearch(): void {
    setTimeout(() => {
      if (!this.multi() && this.selectedLanguages().length > 0) {
        this.isSearching = false;
        this.cdr.markForCheck();
      }
    }, 200);
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.selectedLanguages.set([]);
    this.isSearching = false;
    this.emitValue();
    this.cdr.markForCheck();
  }

  private emitValue(): void {
    const selected = this.selectedLanguages();
    let value: any;

    if (this.multi()) {
      value = this.returnField() === 'object'
        ? selected
        : selected.map(l => this.returnField() === 'name' ? l.name : l.code);
    } else {
      const lang = selected[0];
      if (!lang) {
        value = null;
      } else {
        value = this.returnField() === 'object' ? lang : (this.returnField() === 'name' ? lang.name : lang.code);
      }
    }

    this.onChange(value);
    this.valueChange.emit(value);
  }

  // --- ControlValueAccessor ---

  writeValue(value: any): void {
    if (!value) {
      this.selectedLanguages.set([]);
      this.cdr.markForCheck();
      return;
    }

    const allLangs = this.languages();
    const codes = Array.isArray(value) ? value : [value];

    const resolved = codes
      .map((v: any) => {
        if (typeof v === 'object' && v.code) return v as Language;
        // Match by code or name
        return allLangs.find(l => l.code === v || l.name === v);
      })
      .filter(Boolean) as Language[];

    this.selectedLanguages.set(resolved);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {}
}
