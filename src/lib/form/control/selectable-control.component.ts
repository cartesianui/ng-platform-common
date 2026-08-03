import {
  Component,
  ChangeDetectionStrategy,
  signal,
  effect,
  input,
  model,
  output,
  inject,
  forwardRef,
  AfterViewInit,
  OnDestroy,
  Injector,
  ChangeDetectorRef,
  Inject,
  Optional,
  computed,
  Renderer2,
  ViewChild,
  ElementRef
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NgControl,
  Validators,
  NG_VALIDATORS,
  Validator
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import {
  Observable,
  Observer,
  Subscription,
  asapScheduler,
  forkJoin,
  map,
  observeOn,
  of,
  switchMap,
  tap
} from 'rxjs';
import { AppConfig, ObjectUtils, RequestCriteria, unwrapFractalData } from '@cartesianui/core';
import { isUuid, isValidInteger } from '../../helpers';;
import { FixedPopupPositionDirective } from '../../directives';

@Component({
  selector: 'selectable-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TypeaheadModule, HttpClientModule, FixedPopupPositionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectableControlComponent),
      multi: true
    }
  ],
  template: `
    <div class="selectable-control">
      <div
        class="lookup-input-wrapper form-control d-flex flex-wrap align-items-center"
        [attr.readonly]="readonly() ? true : null"
        (click)="!readonly() && focusInput()"
      >
        <ng-container *ngIf="multi() && computedValues() && computedValues()?.length">
          <span *ngFor="let item of computedValues(); trackBy: trackByKey" class="badge bg-primary me-1 mb-1 d-flex align-items-center">
            {{ getOptionLabel(item) }}
            <button
              *ngIf="!readonly()"
              type="button"
              class="btn-close btn-close-white btn-sm ms-1"
              aria-label="Remove"
              (click)="removeItem(item)"
            ></button>
          </span>
        </ng-container>

        <input
          *ngIf="!readonly()"
          #inputRef
          type="text"
          class="flex-grow-1 border-0"
          [placeholder]="multi() && computedValues()?.length ? '' : placeholder()"
          [typeahead]="this.url() || this.optionsUrl() ? items$ : items()"
          [typeaheadOptionField]="displayField() ?? optionField()"
          (typeaheadOnSelect)="onSelect($event.item)"
          [formControl]="searchControl"
          (blur)="handleBlur()"
          autocomplete="off"
        />
        <span *ngIf="readonly() && !multi() && computedValues()?.length" class="readonly-text">
          {{ getOptionLabel(computedValues()[0]) }}
        </span>
      </div>

      <!--
        A failed lookup must NOT look like an empty one. Before this existed a
        403 rendered as a silent empty dropdown, which is how QA F1 (a missing
        list:any:service grant) was reported as "service search returns []".
        role=alert so screen readers announce it rather than leaving the user
        with a dropdown that simply never opens.
      -->
      <div *ngIf="loadError()" class="lookup-error small mt-1" role="alert">
        {{ loadError() }}
      </div>
    </div>
  `,
  styles: [
    `
      .selectable-control {
        width: 100%;
      }

      /* Themed danger text — matches Bootstrap's .invalid-feedback colour
         without borrowing that class, which is reserved for form-validation
         state and would be misread by anything inspecting validity. */
      .lookup-error {
        color: var(--ct-form-invalid-color, var(--bs-danger, #dc3545));
      }

      /* Match the global .form-control input style (white surface, light
         --ct-border, ~44px height, theme focus ring). The wrapper already
         carries .form-control for bg/border/radius/padding; just align the
         height + focus to the theme. */
      .lookup-input-wrapper {
        min-height: 44px;
        /* anchor for the typeahead dropdown pinned below (see ::ng-deep rule) */
        position: relative;
      }

      /* ── Typeahead suggestions: hard-pin directly below the input ──────────
         ngx-bootstrap appends the <typeahead-container> into the input's parent
         (.lookup-input-wrapper) and positions it with a per-frame
         transform: translate3d() run through its shift/preventOverflow
         modifiers. Inside constrained/scrolled forms & modals those modifiers
         shove the dropdown UPWARD over the input/label (it should open below).
         We override ngx's inline transform/top with !important and pin the list
         to the wrapper's bottom-left. Same root cause + remedy as the queue
         date-picker (see coreui _theme.scss). :host scopes it to this control
         so other typeaheads are unaffected. */
      :host ::ng-deep typeahead-container {
        position: absolute !important;
        inset: auto auto auto 0 !important;
        top: calc(100% + 2px) !important;
        transform: none !important;
        will-change: auto !important;
        width: 100%;
      }

      .lookup-input-wrapper:not([readonly]) {
        cursor: text;
      }

      .lookup-input-wrapper input {
        outline: none;
        min-width: 120px;
        background-color: inherit;
        color: var(--ct-text, inherit);
      }
      .lookup-input-wrapper input::placeholder {
        color: var(--ct-text-faint, #9298ad);
      }

      .lookup-input-wrapper:focus-within:not([readonly]) {
        border-color: var(--cui-primary);
        box-shadow: 0 0 0 0.2rem var(--ct-ring, rgba(79, 70, 229, 0.25));
      }

      .lookup-input-wrapper[readonly] {
        cursor: not-allowed;
        background-color: var(--cui-secondary-bg);
      }

      .readonly-text {
        color: #495057;
      }

      .badge {
        display: flex;
        align-items: center;
        font-size: 0.8rem;
      }

      .btn-close {
        font-size: 0.6rem;
      }
    `
  ]
})
export class SelectableControlComponent<T = any> implements OnDestroy, AfterViewInit, ControlValueAccessor {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  protected injector = inject(Injector);
  protected renderer = inject(Renderer2);
  protected cdr = inject(ChangeDetectorRef);
  protected ngControl: NgControl | null = null;
  protected http = inject(HttpClient);

  protected subs = new Subscription();

  // --- Inputs ---
  url = input<string | null>(null); // backward compatibility
  options = input<T[] | null>(null);
  optionsUrl = input<string | null>(null); // to get options
  getByIdUrl = input<string | null>(null); // in case get by id url is different then options url
  ignoreOptions = input<T[]>([]);
  multi = input(false);
  optionKey = input<string>('id');
  optionField = input('name');
  // Multi-field typeahead: when set, the typed query is matched (`like`)
  // against EACH field and OR-joined — e.g. patients by name / phone / email.
  // Overrides the single-`optionField` search. Each field must be searchable
  // on the BE model (Prettus `$fieldSearchable`). Intended for UNSCOPED
  // pickers (no `searchParams`), since the OR-join applies to all clauses.
  searchFields = input<string[] | null>(null);
  // Cosmetic label field. When provided, the dropdown rows + the selected
  // chip read this property off each item; the user's search query still
  // runs against `optionField` (a real DB column) and that column is still
  // requested in the lookup `filter` so search continues to work. Use this
  // when the BE emits a derived label (e.g. `display_name` with a marker
  // suffix) that you want shown but cannot search against.
  displayField = input<string | null>(null);
  // Relations to load on the lookup endpoint (Apiato `include=` param).
  // Accepts CSV string or string[]. Sent on both list and by-id requests.
  include = input<string | string[] | null>(null);
  // Extra columns to surface in each lookup row, on top of `optionKey`/`optionField`.
  // Accepts CSV string or string[]. Pair with `include` for relation columns.
  lookupFields = input<string | string[] | null>(null);
  placeholder = input('Search...');
  readonly = input(false);
  allowFreeText = input(false);
  /**
   * Extra filters to send alongside the user's name-search. Useful for
   * parent-id scoping (e.g. batches filtered to current `sku_id`). Each
   * key/value is appended to the existing `search` query parameter using
   * Apiato `RequestCriteria` semicolon convention:
   *
   *   search = `${optionField}:${userQuery};${k1}:${v1};${k2}:${v2}`
   *
   * Null values are skipped — pass `null` when you have no parent id yet
   * and the control won't add an empty filter. Callers updating the
   * picker's parent dependency (e.g. SO line: `skuId` changes) should
   * pass a `Signal`-derived value so the picker re-fetches when the
   * dependency changes.
   */
  searchParams = input<Record<string, string | string[] | null | undefined> | null>(null);

  /**
   * How multiple `search` filters combine on the BE (Prettus
   * `RequestCriteria` `searchJoin` parameter).
   *
   * - `'and'` (default): every filter must match. Right for parent-id
   *   scoping — e.g. the batch picker wants `batch_number LIKE …` AND
   *   `sku_id = …`, NOT either-or.
   * - `'or'`: any filter matches. Use when the caller wants a
   *   union of filters (e.g. "name like 'X' OR barcode = 'X'").
   *
   * Only takes effect when `searchParams` adds at least one extra filter.
   * For the user's name-search alone, this input is a no-op.
   *
   * Default changed from Prettus's `'or'` to `'and'` here because
   * picker UX usually wants intersection — overriding the framework
   * default to match caller intent.
   */
  searchJoin = input<'and' | 'or'>('and');

  // --- Two-way bound model (keys) ---
  value = model<T[keyof T][] | T[keyof T] | null>(null);
  valueChange = output<T[keyof T][] | T[keyof T] | null>();

  // --- Two-way bound model (full object(s)) ---
  entity = model<T[] | T | null>(null);
  entityChange = output<T[] | T | null>();
  freeTextChange = output<string>();

  // --- Internal state ---
  items = signal<T[]>([]); // Available option (don't show selected one)

  /**
   * Why a search failed, or null when it did not.
   *
   * Until 2026-08-01 the search `error` handler simply did `items.set([])`, so a
   * 403 / 500 / dropped connection was rendered as an EMPTY RESULT LIST —
   * indistinguishable from "nothing matched". That is not a cosmetic problem:
   * QA F1 ("Care: Queue Entry service search returns []") was reported as a
   * search bug and was actually a missing `list:any:service` grant. The API had
   * answered 403 the whole time; this control turned it into "no results", and
   * the real cause took a permissions investigation to find.
   *
   * "You do not have access" and "there is nothing here" must not look the
   * same, or the next grant gap costs the same investigation.
   */
  loadError = signal<string | null>(null);

  // used with url
  items$: Observable<any>;

  searchControl = new FormControl('');

  // store a pending value when options are not yet available (same as before)
  private pendingRawValue: any = null;

  // Track last fetched ID to prevent duplicate API calls
  private lastFetchedId: any = null;

  // --- Computed state: computedValues used by template for rendering badges etc.
  // Priority: use `entity()` if available, otherwise resolve from `value()`.
  computedValues = computed<T[]>(() => {
    const sel = this.entity();
    if (sel == null) return [];
    if (Array.isArray(sel)) return sel;
    return [sel];
  });

  // Keep previous behavior: also respond to options being set and resolve pending values
  // Track last options reference to avoid reacting to identical arrays (common when
  // parent passes a freshly-created but equal array on each change detection).
  private lastOptionsRef: T[] | null = null;

  readonly optionsEffect = effect(() => {
    const opts = this.options();
    // If options reference hasn't changed, do nothing.
    if (opts === this.lastOptionsRef) return;
    this.lastOptionsRef = opts ?? null;

    if (opts?.length && this.pendingRawValue != null) {
      // Resolve any pending raw value (from writeValue) once options are available
      this.setResolvedValue(this.pendingRawValue);
      this.pendingRawValue = null;
    }
  });

  // watchSelection left in place for possible future use; uses computedValues to react
  watchSelection = effect(() => {
    const vals = this.computedValues();
    // intentionally left minimal - UI updates come via computed and change detection
    // console.log('watchSelection Selection changed:', vals);
    // if(!this.multi()) this.searchControl.setValue(this.getOptionLabel(vals[0]));
  });

  // --- CVA Callbacks (public for template usage) ---
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(@Optional() @Inject(NG_VALIDATORS) private validators: Validator[] = []) {
    // lazy-load ngControl to avoid circular dep
    queueMicrotask(() => {
      try {
        // Injector.get with fallback null
        this.ngControl = this.injector.get(NgControl, null);
        if (this.ngControl) {
          this.ngControl.valueAccessor = this;
        }
      } catch {
        // no form control found
        this.ngControl = null;
      }
    });

    // Load items from URL or data (reactive)
    effect(() => {
      const urlValue = this.optionsUrl() ?? this.url();
      const dataValue = this.options();

      if (urlValue) {
        // Track URL change to trigger id-based fetch if needed
        // this.lastUrlValue = urlValue;

        // If we have a pending value (initial value set), try to fetch it by id first
        if (this.pendingRawValue != null && (isUuid(this.pendingRawValue) || isValidInteger(this.pendingRawValue))) {
          this.getItemById(this.pendingRawValue);
        }

        this.items$ = new Observable((observer: Observer<string | undefined>) => {
          observer.next(this.searchControl.getRawValue());
        }).pipe(
          switchMap((query: string) => {
            if (!query) return of([]);
            // Build the request through `RequestCriteria` so we go through
            // ONE Prettus param builder (formerly inline; the duplication
            // motivated `picker-criteria-refactor`).
            //   - `.where(field, 'like', query)`           → user's name search
            //   - `.where(k, '=', v)` for each searchParam  → caller filters
            //   - `.searchJoin(join)` when extras present   → intersect vs union
            //   - `.with(include)`                         → relations
            //   - `.asLookup([key, field, ...lookupFields]) → output=lookup
            // RequestCriteria handles API key conversion internally — no
            // manual `ObjectUtils.convertKey` calls here.
            const criteria = this.buildPickerCriteria(query);
            const params = criteria.pairs() as Record<string, string>;
            return this.http
              .get<any>(`${AppConfig.remoteServiceBaseUrl}${urlValue}`, { params })
              .pipe(
                map((res) => {
                  // check response keys conversion settings
                  if (AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP) {
                    return ObjectUtils.convertObjectKeys(res.data, AppConfig.keysFormatAPI, AppConfig.keysFormatAPP);
                  }
                  return res.data || []
                }),
                tap({
                  next: (items) => {
                    // Defer signal update to avoid ExpressionChangedAfterItHasBeenCheckedError
                    // This prevents typeahead component from detecting changes during same CD cycle
                    setTimeout(() => {
                      this.loadError.set(null);
                      this.items.set(items ?? []);
                      if (this.pendingRawValue != null) {
                        // Resolve pending once we have items/options (edit prefill)
                        this.setResolvedValue(this.pendingRawValue);
                        this.pendingRawValue = null;
                      }
                      // NOTE: Do NOT call setResolvedValue(this.value()) here.
                      // `items` is the live search-result list driven by the
                      // user's current keystroke; resolving the existing value
                      // against it almost always misses, and the single-select
                      // branch then clears `searchControl` — wiping the text
                      // the user is actively typing.
                      this.cdr.markForCheck();
                    }, 0);
                  },
                  error: (err: any) => {
                    // Distinguish "failed" from "nothing matched" — see
                    // `loadError`. The interceptor rethrows either a
                    // CartesianResponse or an HttpResponse clone; both carry
                    // `status`.
                    const status = err?.status ?? err?.statusCode ?? null;
                    setTimeout(() => {
                      this.items.set([]);
                      this.loadError.set(
                        status === 403
                          ? 'You do not have permission to view these options.'
                          : 'Could not load options. Please try again.'
                      );
                    }, 0);
                    this.cdr.markForCheck();
                  }
                })
              );
          }),
          // ngx-bootstrap's TypeaheadContainerComponent updates its matches
          // (and calls change detection) synchronously inside this
          // observable's subscribe callback. The `tap` above only defers
          // OUR OWN `items` signal update — the emission ngx-bootstrap
          // itself receives is not delayed by it, so an HTTP response that
          // lands mid change-detection pass hands the container a new
          // array before Angular's current check has finished, tripping
          // NG0100. Rescheduling the emission onto a microtask sidesteps
          // that: by the time ngx-bootstrap sees it, the in-flight CD pass
          // has already completed.
          observeOn(asapScheduler)
        );
      } else if (dataValue) {
        // Defer signal update to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.items.set(dataValue ?? []);
          // If we already have value stored, ensure `selected` is resolved from those options
          if (this.value() != null) {
            this.setResolvedValue(this.value());
          }
          this.cdr.markForCheck();
        }, 0);
      } else {
        setTimeout(() => {
          this.items.set([]);
        }, 0);
      }
    });

    // Watch the search input so that when user clears it we propagate a null value to the parent
    this.subs.add(
      this.searchControl.valueChanges.pipe(observeOn(asapScheduler)).subscribe((val: any) => {
        const isEmptyString = typeof val === 'string' && val.trim() === '';
        if (isEmptyString) {
          if (this.value() != null || this.entity() != null) {
            this.setValue(null);
          }
          if (this.allowFreeText()) {
            this.freeTextChange.emit('');
          }
        } else if (this.allowFreeText() && typeof val === 'string') {
          this.freeTextChange.emit(val);
        }
      })
    );
  }

  /**
   * Build a "fetch by id" URL while preserving any query string already on
   * the configured URL (e.g. `/employees?roles=ehr-opd-nurse` → `/employees/{id}?roles=ehr-opd-nurse`).
   * Appends `include=` from the [include] input if one is set and the URL
   * doesn't already carry an include param.
   */
  private buildByIdUrl(url: string, id: any): string {
    const queryIdx = url.indexOf('?');
    const base = queryIdx >= 0 ? url.slice(0, queryIdx) : url;
    let query = queryIdx >= 0 ? url.slice(queryIdx) : '';

    const includeParam = this.csv(this.include());
    if (includeParam && !/[?&]include=/.test(query)) {
      query += (query ? '&' : '?') + 'include=' + encodeURIComponent(includeParam);
    }

    return `${AppConfig.remoteServiceBaseUrl}${base}/${id}${query}`;
  }

  /** Coerce CSV string | string[] | null to a deduped CSV string (empty → ''). */
  private csv(value: string | string[] | null | undefined): string {
    if (!value) return '';
    const parts = Array.isArray(value) ? value : value.split(',');
    const cleaned = parts.map((p) => p.trim()).filter((p) => p.length > 0);
    return Array.from(new Set(cleaned)).join(',');
  }

  /**
   * Build a `RequestCriteria` describing the typeahead's current search.
   * One place owns Prettus param shape — see `picker-criteria-refactor`.
   *
   * Composition:
   *   - `where(optionField, 'like', userQuery)`     name-search clause
   *   - `where(k, '=', v)` per `searchParams`       caller scoping filters
   *   - `searchJoin(this.searchJoin())`             intersection vs union
   *   - `with(this.include())`                       Apiato include= relations
   *   - `output('lookup')`                           trigger LookupResponseMiddleware
   *   - `filter([optionKey, optionField, ...lookupFields])`  pick columns
   *
   * `output` + `filter` are orthogonal: `output('lookup')` is the mode
   * switch; `filter()` selects columns the same way it does on normal
   * listings. The BE LookupResponseMiddleware reads both.
   *
   * `RequestCriteria` does API key conversion internally — caller passes
   * app-format keys (camelCase) and the emitted `search`/`searchFields`
   * params carry the BE-format (snake_case) names.
   */
  private buildPickerCriteria(userQuery: string): RequestCriteria {
    const criteria = new RequestCriteria();
    // Multi-field search (name/phone/email/…) when `searchFields` is set,
    // OR-joined; otherwise the single `optionField` `like` clause.
    const fields = this.searchFields();
    const multiField = !!(fields && fields.length);
    if (multiField) {
      for (const f of fields!) criteria.where(f, 'like', userQuery);
    } else {
      criteria.where(this.optionField(), 'like', userQuery);
    }

    const extra = this.searchParams();
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v === null || v === undefined || v === '') continue;
        // Array → `in` (Prettus): `searchFields=k:in&search=k:a,b`.
        // `=` would emit `k = 'a,b'` (literal CSV) and match nothing.
        if (Array.isArray(v)) {
          if (!v.length) continue;
          criteria.where(k, 'in', v.join(','));
        } else {
          criteria.where(k, '=', v);
        }
      }
    }

    // Multi-field query is inherently OR (match ANY field). Single-field
    // search honours the caller's searchJoin (intersect/union with scoping).
    criteria.searchJoin(multiField ? 'or' : this.searchJoin());

    const includeCsv = this.csv(this.include());
    if (includeCsv) {
      criteria.with(includeCsv);
    }

    // Column selection: key + field + optional display field + any
    // caller-declared lookupFields. `displayField` is requested so the
    // BE-derived label (e.g. `display_name`) lands on each row for the
    // typeahead to render; it's NOT used in the where-clause above.
    const cols = [this.optionKey(), this.optionField()];
    const display = this.displayField();
    if (display && display !== this.optionField()) cols.push(display);
    const extras = this.csv(this.lookupFields());
    if (extras) cols.push(...extras.split(','));
    criteria.filter(cols);

    // Trigger the BE LookupResponseMiddleware (skip pagination, unwrap
    // Fractal `{data: ...}` on included relations).
    criteria.output('lookup');

    return criteria;
  }

  // Fetch multiple items by ids in parallel (used for multi-select edit
  // prefill, where the form value is an id[] but the picker has no items
  // pre-loaded). Mirrors `getItemById` but merges results into `items()` and
  // resolves the pending array as a whole once all responses come back.
  private getItemsByIds(ids: any[]): void {
    const url = this.getByIdUrl() ?? this.optionsUrl() ?? this.url();
    if (!url) return;

    const requests = ids.map((id) =>
      this.http.get<any>(this.buildByIdUrl(url, id))
    );

    this.subs.add(
      forkJoin(requests).subscribe({
        next: (responses) => {
          const fetched = responses
            .map((res: any) => {
              let item = res?.data || res;
              if (AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP) {
                item = ObjectUtils.convertObjectKeys(res.data, AppConfig.keysFormatAPI, AppConfig.keysFormatAPP);
              }
              // Strip Fractal envelopes from included relations — see
              // `unwrapFractalData` doc-comment in helpers.ts.
              return unwrapFractalData(item);
            })
            .filter((it) => !!it);

          if (!fetched.length) return;

          setTimeout(() => {
            // Merge with anything already in items (e.g. options pre-loaded).
            const existing = this.items() ?? [];
            const merged = [...existing];
            for (const it of fetched) {
              const key = this.optionKey() as string;
              if (!merged.some((m: any) => m?.[key] === (it as any)?.[key])) {
                merged.push(it);
              }
            }
            this.items.set(merged);
            this.setResolvedValue(ids);
            this.pendingRawValue = null;
            this.cdr.markForCheck();
          }, 0);
        },
        error: () => {
          this.cdr.markForCheck();
        }
      })
    );
  }

  /**
   * Look for an already-available option matching `id` — either in the
   * caller-supplied `[options]` list or the pre-resolved `[entity]` input.
   * Lets `getItemById` resolve a known value without an HTTP round-trip
   * (used by server-bundled forms that ship the resolved option inline).
   */
  private findPreloadedById(id: any): T | null {
    const key = this.optionKey() as string;

    const opts = this.options() ?? [];
    const inOpts = (opts as any[]).find((o: any) => o?.[key] === id);
    if (inOpts) return inOpts as T;

    const ent = this.entity();
    const arr = Array.isArray(ent) ? ent : ent ? [ent] : [];
    const inEnt = (arr as any[]).find((o: any) => o?.[key] === id);
    return (inEnt as T) ?? null;
  }

  // Fetch a single item by id from the URL endpoint (used for edit forms with initial id value)
  private getItemById(id: any): void {
    // Prevent duplicate fetches for the same ID. The cache is only ever set
    // AFTER a successful HTTP response (see `lastFetchedId = id` inside the
    // `next` handler) — never speculatively. That way a transient failure
    // (URL not ready, network blip, BE 500) leaves the picker free to retry
    // on the next writeValue or url-effect tick, instead of silently
    // suppressing the request forever.
    if (this.lastFetchedId === id) {
      return;
    }

    // Caller pre-supplied the resolved option (via `[entity]` or `[options]`,
    // e.g. a server-bundled config form) — resolve locally and SKIP the HTTP
    // round-trip. Purely additive: only short-circuits when a matching option
    // is already present; otherwise the normal fetch below runs unchanged.
    const preloaded = this.findPreloadedById(id);
    if (preloaded) {
      const key = this.optionKey() as string;
      setTimeout(() => {
        const existing = this.items() ?? [];
        if (!existing.some((m: any) => m?.[key] === id)) {
          this.items.set([...existing, preloaded]);
        }
        this.setResolvedValue(id);
        this.pendingRawValue = null;
        this.lastFetchedId = id;
        this.cdr.markForCheck();
      }, 0);
      return;
    }

    const url = this.getByIdUrl() ?? this.optionsUrl() ?? this.url();
    if (!url) {
      // No URL yet — bail and let the URL effect retry once the input
      // signal settles. `pendingRawValue` (set by the caller in writeValue)
      // is the rendezvous point that lets the effect pick this up.
      return;
    }

    this.subs.add(
      this.http
        .get<any>(this.buildByIdUrl(url, id))
        .subscribe({
          next: (res) => {
            // Handle wrapped response (e.g., { data: {...} })
            let item = res?.data || res;
            if (AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP) {
              item = ObjectUtils.convertObjectKeys(res.data, AppConfig.keysFormatAPI, AppConfig.keysFormatAPP);
            }
            // Strip Fractal `{ data: ... }` envelopes from included relations
            // so consumers can walk the tree without an extra `data` hop at
            // every boundary. Matches the lookup-mode response shape.
            item = unwrapFractalData(item);

            if (item) {
              // Defer signal update to avoid ExpressionChangedAfterItHasBeenCheckedError
              setTimeout(() => {
                this.items.set([item]);
                this.setResolvedValue(id);
                this.pendingRawValue = null;
                // Only now is it safe to mark this id as resolved.
                this.lastFetchedId = id;
                this.cdr.markForCheck();
              }, 0);
            }
          },
          error: () => {
            // Don't pollute the dedup cache — a future attempt should be
            // free to retry. `lastFetchedId` was never set, nothing to clear.
            this.cdr.markForCheck();
          }
        })
    );
  }

  // --- Selection logic ---
  onSelect(item: T) {
    const key = this.getOptionKey(item);
    // current keys array
    const currentKeys = this.toArray(this.value()) as any[];

    const exists = currentKeys.includes(key);
    const updatedKeys = this.multi() ? (exists ? currentKeys.filter((k) => k !== key) : [...currentKeys, key]) : [key];

    const valueToSet = this.multi() ? updatedKeys : updatedKeys[0];

    // setValue will also set `selected` appropriately (resolve item objects)
    this.setValue(valueToSet);

    // For UX: clear input for multi (tags are visible)
    if (this.multi()) this.searchControl.patchValue('', { emitEvent: false });
  }

  removeItem(item: T): void {
    const key = this.getOptionKey(item);
    const filteredKeys = this.toArray(this.value()).filter((id) => id !== key);
    const valueToSet = this.multi() ? filteredKeys : null;
    this.setValue(valueToSet);
  }

  // --- Core value propagation ---
  private setValue(value: any) {
    // Avoid duplicate propagation if same (compare serialized)
    let isValueChanged = true;
    try {
      const prev = this.value();
      if (JSON.stringify(prev) === JSON.stringify(value)) {
        isValueChanged = false;
        // still ensure selected is in sync (in case selected drifted)
        try {
          const resolved = this.resolveItemsFromValue(value);
          // set selected if different
          const prevSelection = this.entity();
          const newSelection = this.multi() ? resolved : resolved[0] ?? null;
          if (JSON.stringify(prevSelection) !== JSON.stringify(newSelection)) {
            // Defer to next CD cycle to avoid ExpressionChangedAfterItHasBeenCheckedError
            setTimeout(() => {
              this.entity.set(newSelection);
              this.entityChange.emit(newSelection);
            }, 0);
          }
        } catch {
          // ignore
        }
        return;
      }
    } catch {
      // fallthrough
    }

    // Defer signal updates and emissions to next change detection cycle
    // This prevents ExpressionChangedAfterItHasBeenCheckedError when used in forms with effects
    setTimeout(() => {
      // Normalize & store the key(s) in `value`
      this.value.set(value);
      this.valueChange.emit(value);

      // Resolve and store selected object(s) from available options/items where possible.
      const resolvedItems = this.resolveItemsFromValue(value);
      const selectedToSet = this.multi() ? resolvedItems : resolvedItems.length ? resolvedItems[0] : null;
      this.entity.set(selectedToSet);
      this.entityChange.emit(selectedToSet);

      // notify Angular forms via CVA callback ONLY if value actually changed
      if (isValueChanged) {
        this.onChange(value);
      }

      // mark touched (we consider a change to be an interaction)
      this.onTouched();

      // Update parent control validity/status without setting parent value
      try {
        const ctrl = this.ngControl?.control;
        if (ctrl) {
          ctrl.markAsDirty();
          ctrl.updateValueAndValidity({ emitEvent: false });
        }
      } catch {
        // swallow
      }

      // ensure UI updates under OnPush
      this.cdr.markForCheck();
    }, 0);
  }

  private setResolvedValue(value: any): void {
    // This function expects `value` to be either keys or full item objects.
    // It will set both `value` (keys) and `selected` (object(s)), and update the searchControl UI.
    // Defer to next CD cycle when called from effects to avoid ExpressionChangedAfterItHasBeenCheckedError

    if (value == null || (Array.isArray(value) && value.length === 0)) {
      // Clear both - defer to avoid CD errors
      setTimeout(() => {
        this.value.set(null);
        this.entity.set(null);
        this.valueChange.emit(null);
        this.entityChange.emit(null);
        this.searchControl.setValue('', { emitEvent: false });
        this.cdr.markForCheck();
      }, 0);
      return;
    }

    // Defer all signal updates and emissions to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      if (this.multi()) {
        // Expecting array or single -> treat as array of keys or objects
        const resolvedItems = this.resolveItemsFromValue(value);
        const keys = resolvedItems.map((i) => this.getOptionKey(i)).filter((k) => k != null);

        // Avoid emitting if keys are identical to current value
        try {
          const curr = this.value();
          if (JSON.stringify(curr) !== JSON.stringify(keys)) {
            this.value.set(keys);
            this.valueChange.emit(keys);
          }
        } catch {
          this.value.set(keys);
          this.valueChange.emit(keys);
        }

        // Update entity only when changed
        try {
          const currEntity = this.entity();
          if (JSON.stringify(currEntity) !== JSON.stringify(resolvedItems)) {
            this.entity.set(resolvedItems);
            this.entityChange.emit(resolvedItems);
          }
        } catch {
          this.entity.set(resolvedItems);
          this.entityChange.emit(resolvedItems);
        }

        // show no text for multi (tags are displayed)
        this.searchControl.patchValue('', { emitEvent: false });
      } else {
        // single select: want single key stored, and label shown in searchControl
        const resolvedItems = this.resolveItemsFromValue(value);
        const first = resolvedItems.length ? resolvedItems[0] : null;
        const keyToStore = first ? this.getOptionKey(first) : Array.isArray(value) ? (value[0] ?? null) : value;

        try {
          const curr = this.value();
          if (JSON.stringify(curr) !== JSON.stringify(keyToStore)) {
            this.value.set(keyToStore);
            this.valueChange.emit(keyToStore);
          }
        } catch {
          this.value.set(keyToStore);
          this.valueChange.emit(keyToStore);
        }

        try {
          const currEntity = this.entity();
          if (JSON.stringify(currEntity) !== JSON.stringify(first)) {
            this.entity.set(first);
            this.entityChange.emit(first);
          }
        } catch {
          this.entity.set(first);
          this.entityChange.emit(first);
        }

        if (first) {
          this.searchControl.setValue(this.getOptionLabel(first), { emitEvent: false });
        } else {
          // If we couldn't resolve the object (no matching option), show empty string
          this.searchControl.setValue('', { emitEvent: false });
        }
      }

      this.cdr.markForCheck();
    }, 0);
  }

  // Resolve item objects from a provided value (value can be keys or full item objects)
  private resolveItemsFromValue(value: any): T[] {
    // All available candidate options: user-supplied options OR currently fetched items
    const allOptions = (this.options() ?? this.items() ?? []) as T[];
    const keys = Array.isArray(value) ? value : [value];

    // If value elements are objects that look like options already, return them (preserve order)
    const maybeObjects = keys.filter((k) => k && typeof k === 'object' && this.getOptionKey(k) != null);
    if (maybeObjects.length === keys.length) {
      return maybeObjects as T[];
    }

    // Otherwise, treat keys as key values and find matching option objects
    // If an item for a key isn't present in the available options (e.g. because
    // items are coming from a search result), fall back to any previously
    // selected entities stored in `this.entity()` so multi-select doesn't lose
    // already-selected tags when they are not present in the current options.
    const found: T[] = [];
    const prevSelection = this.entity();
    const prevArr = prevSelection == null ? [] : Array.isArray(prevSelection) ? prevSelection : [prevSelection];

    for (const k of keys) {
      let match: T | undefined = undefined;
      try {
        match = allOptions.find((opt) => this.keysEqual(this.getOptionKey(opt), k));
      } catch {
        match = undefined;
      }

      // If not found in the current option set, try previously selected entities
      if (!match && prevArr.length) {
        try {
          match = prevArr.find((opt) => this.keysEqual(this.getOptionKey(opt), k));
        } catch {
          match = undefined;
        }
      }

      if (match) found.push(match);
      // if still not found, we don't invent objects — leave missing ones out
    }

    return found;
  }

  handleBlur() {
    this.onTouched();

    // When allowFreeText is enabled and user typed text without selecting from dropdown,
    // preserve the typed text and emit it via freeTextChange
    if (this.allowFreeText()) {
      const typed = this.searchControl.getRawValue()?.trim() ?? '';
      if (typed && this.entity() == null) {
        this.freeTextChange.emit(typed);
      }
    }

    try {
      const ctrl = this.ngControl?.control;
      if (ctrl) {
        ctrl.markAsTouched();
        ctrl.updateValueAndValidity({ emitEvent: true });
      }
    } catch {
      // ignore
    }
    this.cdr.markForCheck();
  }

  // --- CVA Interface ---
  writeValue(value: any): void {
    // If options are not yet available, store pending and resolve later
    if (!this.options()?.length && !(this.items() && this.items().length)) {
      this.pendingRawValue = value;

      // If we have a URL configured and the value is a valid ID, fetch it immediately
      const url = this.getByIdUrl() ?? this.optionsUrl() ?? this.url();
      if (url && value != null && (isUuid(value) || isValidInteger(value))) {
        this.getItemById(value);
      } else if (url && Array.isArray(value) && value.length > 0 && value.every((v) => isUuid(v) || isValidInteger(v))) {
        // Multi-select edit-prefill: fetch each id so badges resolve.
        this.getItemsByIds(value);
      }
    } else {
      this.setResolvedValue(value);
      this.pendingRawValue = null;
    }

    // Also clear both when null/empty
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      this.value.set(null);
      this.entity.set(null);
      this.searchControl.setValue('', { emitEvent: false });
      // Emit clears to keep parent in sync (safe to emit here)
      this.valueChange.emit(null);
      this.entityChange.emit(null);
      // Reset fetch cache when value is cleared
      this.lastFetchedId = null;
    }

    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.searchControl.disable() : this.searchControl.enable();
    this.cdr.markForCheck();
  }

  // ---- Helpers ---
  getOptionKey(item: T): any {
    try {
      return item?.[this.optionKey()];
    } catch {
      return undefined;
    }
  }

  /**
   * Compare two option keys for identity, tolerating type drift between the
   * stored form value and the fetched option's key. Integer-keyed lookups
   * (e.g. countries: PK `int`) round-trip through the config layer as STRINGS
   * — the BE coerces `entity` config values to string — so on edit-prefill the
   * stored `"167"` must still match the fetched country's numeric `167`. uuid
   * keys are string-on-both-sides and unaffected. Null/undefined never match.
   */
  private keysEqual(a: any, b: any): boolean {
    if (a == null || b == null) return false;
    return a === b || String(a) === String(b);
  }

  getOptionLabel(item: T): string {
    // Prefer the display field, fall back to the option field — a resolved
    // option may carry only the option field (e.g. server-bundled config
    // values where the display column is lookup-computed). Without the
    // fallback the label would render "[object Object]".
    const disp = this.displayField();
    const opt = this.optionField();
    const val =
      (item && disp ? (item as any)[disp] : undefined) ??
      (item ? (item as any)[opt] : undefined);
    return (val ?? String(item)) as string;
  }

  equals(a: T, b: T): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return a === b;
    }
  }

  private toArray(value: any): any[] {
    return Array.isArray(value) ? value : value != null ? [value] : [];
  }

  trackByKey = (index: number, item: any) => {
    return this.getOptionKey(item) ?? index;
  };

  focusInput() {
    this.inputRef?.nativeElement?.focus();
  }

  // --- life cycle functions ---

  ngAfterViewInit() {
    // lazy DI for ngControl
    this.ngControl = this.injector.get(NgControl, null);
    // console.log('DIAG: ngControl =>', this.ngControl);
    // console.log('DIAG: ngControl.control =>', this.ngControl?.control);
    // console.log('DIAG: validators QueryList =>', this.validators);
    // console.log('DIAG: validators length =>', this.validators?.length);

    if (this.ngControl?.control && this.validators?.length) {
      const composed = Validators.compose(this.validators.map((v) => v.validate.bind(v)));
      const existing = this.ngControl.control.validator;
      const composedValidator = existing ? Validators.compose([existing, composed]) : composed;

      this.ngControl.control.setValidators(composedValidator);
      this.ngControl.control.updateValueAndValidity({ emitEvent: false });

      // DIAGNOSTICS — optional (kept from original)
      const ctrl = this.ngControl!.control!;
      // console.log('DIAG: control.value =>', ctrl.value);
      // console.log('DIAG: control.validator(ctrl) =>', ctrl.validator ? ctrl.validator(ctrl) : null);
      // this.validators.forEach((v, i) => console.log(`DIAG: validator[${i}] ->`, v.constructor.name, '->', v.validate(ctrl)));
    }

    // Ensure selected is in sync with value if options already exist
    if (this.value() != null && (this.options() ?? this.items()).length) {
      this.setResolvedValue(this.value());
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.lastFetchedId = null;
  }
}
