import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2, RendererStyleFlags2 } from '@angular/core';

/**
 * Applies automatically to every `bsDatepicker`/`typeahead` trigger app-wide
 * (matches by attribute presence — no per-template opt-in needed) to fix
 * ngx-bootstrap popups (`bsDatepicker`'s `<bs-datepicker-container>`,
 * `typeahead`'s `<typeahead-container>`) getting clipped when the trigger
 * sits inside a scrolling ancestor — e.g. a repeatable line-items grid's
 * `.line-items-area` (`overflow-y: auto`, see `_theme.scss`).
 *
 * ngx-bootstrap appends these as plain local DOM siblings in the trigger's
 * parent (no CDK Overlay/body portal — `container="body"` is deliberately
 * avoided app-wide, see `_theme.scss`, because it previously made `<body>`
 * grow phantom scroll height inside `overflow:hidden` shells). That's fine
 * almost everywhere, but an ancestor with `overflow: hidden`/`auto` clips
 * the popup once it renders past that ancestor's edge. Re-pinning it with
 * `position: fixed`, computed from the trigger's real viewport rect, escapes
 * that clip without moving the DOM node — `position: fixed` boxes are
 * excluded from every ancestor's scrollable-overflow (and clip) region,
 * same reason they can't inflate `<body>`'s scrollHeight either — as long as
 * no ancestor between here and `<body>` applies a transform/filter/
 * perspective (that would create a new containing block and reintroduce the
 * clip; none currently do).
 *
 * `_theme.scss` already forces `position: absolute !important` on every
 * `bs-datepicker-container`/`typeahead-container` in the app (a global,
 * non-scoped override, same precedent this directive follows) — this
 * directive's inline `!important` styles win over that stylesheet rule (an
 * inline `!important` always outranks an author-stylesheet `!important`),
 * so no CSS file needs to change.
 */
@Directive({
  selector: '[bsDatepicker], [typeahead]',
  standalone: true
})
export class FixedPopupPositionDirective implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;
  private cleanup?: () => void;

  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    const parent = this.el.nativeElement.parentElement;
    if (!parent) return;

    this.observer = new MutationObserver(() => {
      const popup = parent.querySelector('bs-datepicker-container, typeahead-container') as HTMLElement | null;
      if (popup && !this.cleanup) {
        this.pinToViewport(popup);
      } else if (!popup && this.cleanup) {
        this.cleanup();
        this.cleanup = undefined;
      }
    });
    this.observer.observe(parent, { childList: true });
  }

  private pinToViewport(popup: HTMLElement): void {
    const important = RendererStyleFlags2.Important;
    // Only the typeahead list should be pinned to the trigger's width — a
    // date-picker calendar has its own intrinsic width and would be crushed
    // if forced down to a narrow date input's width.
    const isTypeahead = popup.tagName.toLowerCase() === 'typeahead-container';
    const reposition = () => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      this.renderer.setStyle(popup, 'position', 'fixed', important);
      this.renderer.setStyle(popup, 'top', `${rect.bottom + 2}px`, important);
      this.renderer.setStyle(popup, 'left', `${rect.left}px`, important);
      if (isTypeahead) {
        this.renderer.setStyle(popup, 'width', `${rect.width}px`, important);
      }
      this.renderer.setStyle(popup, 'transform', 'none', important);
    };
    reposition();

    // Scroll events don't bubble, but capture-phase listeners on `document`
    // still fire for scroll on any descendant scrollable element (e.g.
    // `.line-items-area`), not just window scroll.
    document.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition, { passive: true });

    this.cleanup = () => {
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.cleanup?.();
  }
}
