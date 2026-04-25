import { ChangeDetectionStrategy, Component, Input, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Image thumbnail with optional click/hover preview.
 *
 * Slim component — just an `<img>` with the same preview behavior as
 * `<file-attachment>` (lightbox / inline / overlay), without the upload,
 * replace, remove chrome. Use in datatable cells, list rows, anywhere
 * a static image needs a preview-on-interact.
 *
 * For images with upload/replace lifecycle, use `<file-attachment>`.
 */
@Component({
  selector: 'image-thumb',
  templateUrl: './image-thumb.component.html',
  styleUrls: ['./image-thumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class ImageThumbComponent implements OnChanges {

  /** Image URL. */
  @Input({ required: true }) src!: string | null | undefined;

  /** Alt text. */
  @Input() alt = '';

  /** Show fallback icon when src is empty. */
  @Input() showFallback = true;

  /** Thumb size preset (or use thumbWidth/thumbHeight to override). */
  @Input() thumbSize: 'small' | 'medium' | 'large' | 'avatar' = 'medium';
  @Input() thumbWidth?: number;
  @Input() thumbHeight?: number;

  /** Square (rounded) or circular thumb. `avatar` thumb size implies round. */
  @Input() shape: 'square' | 'round' = 'square';

  /**
   * Preview behavior on click.
   *  - `none`: no preview interaction.
   *  - `lightbox` (default): click → full-screen overlay.
   *  - `inline`: click/hover → panel below (pushes layout).
   *  - `overlay`: click/hover → floating panel (does not push layout).
   */
  @Input() previewMode: 'none' | 'lightbox' | 'inline' | 'overlay' = 'lightbox';

  @Input() previewTrigger: 'click' | 'hover' = 'click';

  /** Preview size preset. */
  @Input() previewSize: 'xs' | 'passport' | 'avatar' | 'small' | 'medium' | 'large' | 'product' = 'medium';
  @Input() previewWidth?: number;
  @Input() previewHeight?: number;

  protected lightboxOpen = signal(false);
  protected inlineOpen = signal(false);

  ngOnChanges(): void {
    // Close any open panels if src changes.
    this.lightboxOpen.set(false);
    this.inlineOpen.set(false);
  }

  // ─── Interaction ───────────────────────────────────────

  onThumbClick(event: Event): void {
    if (this.previewMode === 'none' || !this.src) return;
    event.stopPropagation();
    event.preventDefault();

    if (this.previewMode === 'lightbox') {
      this.lightboxOpen.set(true);
      return;
    }

    if (this.previewTrigger === 'click') {
      this.inlineOpen.update(v => !v);
    }
  }

  onThumbHover(open: boolean): void {
    if (this.previewMode === 'none' || this.previewMode === 'lightbox') return;
    if (this.previewTrigger !== 'hover' || !this.src) return;
    this.inlineOpen.set(open);
  }

  closeLightbox(event?: Event): void {
    event?.stopPropagation();
    this.lightboxOpen.set(false);
  }

  // ─── Size resolution ───────────────────────────────────

  private static readonly PREVIEW_PRESETS: Record<string, { width: number; height: number }> = {
    xs:       { width: 80,  height: 100 },
    passport: { width: 120, height: 150 },
    avatar:   { width: 160, height: 160 },
    small:    { width: 200, height: 200 },
    medium:   { width: 280, height: 280 },
    large:    { width: 400, height: 400 },
    product:  { width: 320, height: 320 },
  };

  private static readonly THUMB_PRESETS: Record<string, { width: number; height: number; round: boolean }> = {
    small:  { width: 32, height: 32, round: false },
    medium: { width: 48, height: 48, round: false },
    large:  { width: 64, height: 64, round: false },
    avatar: { width: 64, height: 64, round: true },
  };

  protected previewStyle(): Record<string, string> {
    const preset = ImageThumbComponent.PREVIEW_PRESETS[this.previewSize] ?? ImageThumbComponent.PREVIEW_PRESETS['medium'];
    return {
      'max-width.px': String(this.previewWidth ?? preset.width),
      'max-height.px': String(this.previewHeight ?? preset.height),
    } as any;
  }

  protected thumbStyle(): Record<string, string> {
    const preset = ImageThumbComponent.THUMB_PRESETS[this.thumbSize] ?? ImageThumbComponent.THUMB_PRESETS['medium'];
    const width = this.thumbWidth ?? preset.width;
    const height = this.thumbHeight ?? preset.height;
    const round = this.shape === 'round'
      || (this.thumbSize === 'avatar' && this.thumbWidth === undefined && this.thumbHeight === undefined && this.shape !== 'square');
    return {
      'width.px': String(width),
      'height.px': String(height),
      'border-radius': round ? '50%' : '0.25rem',
    } as any;
  }

  protected canPreview(): boolean {
    return this.previewMode !== 'none' && !!this.src;
  }

  protected thumbCursor(): string {
    if (!this.canPreview()) return 'default';
    if (this.previewMode === 'lightbox') return 'zoom-in';
    return this.previewTrigger === 'hover' ? 'default' : 'zoom-in';
  }
}
