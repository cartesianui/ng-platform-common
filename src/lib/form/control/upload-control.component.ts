import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { signal, computed, input, output } from '@angular/core';

// ---- Types ----
export type AwsConfig = {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  [key: string]: unknown;
};

export type SignedUrlProvider = (file: File) => Promise<string>;
export type UploadFunction = (args: {
  file: File;
  signedUrl: string;
  onProgress?: (percent: number) => void;
  abortSignal?: AbortSignal;
}) => Promise<UploadResult>;

export type UploadResult = {
  success: boolean;
  status: number | null;
  location?: string; // S3 object URL (if known)
  response?: unknown;
  error?: string;
};

// ---- Component ----
@Component({
  selector: 'file-uploader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'file-uploader',
    role: 'region',
    'aria-label': 'File uploader',
  },
  template: `
    <div class="uploader-root" (drop)="onDrop($event)" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)">
      <label class="upload-label" [attr.for]="fileInputId">
        <div class="upload-box" [attr.aria-hidden]="isUploading() ? 'true' : 'false'">
          <div class="upload-instructions">
            <div><strong>Choose a file</strong> or drag it here</div>
            <div class="muted small">Accepted: {{ accept() || '*' }} • Max files: {{ multiple() ? 'multiple' : '1' }}</div>
          </div>
          <div *ngIf="previewSrc()" class="preview" role="img" [attr.aria-label]="'Preview of ' + (selectedFileName() || 'file')">
            <img [src]="previewSrc()" alt="" />
          </div>
        </div>
      </label>

      <input
        #fileInput
        type="file"
        [id]="fileInputId"
        class="visually-hidden"
        (change)="onFilesSelected($event)"
        [attr.accept]="accept() || null"
        [attr.multiple]="multiple() ? '' : null"
      />

      <div class="controls" *ngIf="selectedFileName()">
        <div class="file-meta">
          <div class="file-name">{{ selectedFileName() }}</div>
          <div class="file-size small muted">{{ selectedFileSizeText() }}</div>
        </div>

        <div class="actions">
          <button type="button" (click)="startUpload()" [disabled]="!canUpload()" aria-disabled="{{ !canUpload() }}">Upload</button>
          <button type="button" (click)="cancelUpload()" [disabled]="!isUploading()" aria-disabled="{{ !isUploading() }}">Cancel</button>
          <button type="button" (click)="clear()" [disabled]="isUploading()" aria-disabled="{{ isUploading() }}">Clear</button>
        </div>

        <div class="progress-row" *ngIf="isUploading() || progress() > 0">
          <progress [attr.value]="progress()" max="100" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()"></progress>
          <div class="progress-text small">{{ progress() }}%</div>
        </div>

        <div *ngIf="error()" class="error small" role="alert" aria-live="assertive">{{ error() }}</div>
        <div *ngIf="lastResult()?.success" class="success small" role="status" aria-live="polite">Upload complete.</div>
      </div>
    </div>
  `,
  styles: [
    `
      .visually-hidden { position: absolute !important; height: 1px; width: 1px; overflow: hidden; clip: rect(1px, 1px, 1px, 1px); white-space: nowrap; border: 0; padding: 0; margin: -1px; }
      .upload-box { border: 2px dashed #ccd; padding: 1rem; border-radius: 8px; display:flex; gap:1rem; align-items:center; justify-content:space-between; min-height:90px; }
      .upload-instructions { flex:1; }
      .preview img { max-height:64px; max-width:64px; display:block; border-radius:4px; }
      .controls { margin-top:0.5rem; display:flex; flex-direction:column; gap:0.5rem; }
      .file-meta { display:flex; justify-content:space-between; align-items:center; }
      .actions { display:flex; gap:0.5rem; }
      button[disabled], button[aria-disabled="true"] { opacity: 0.6; cursor: not-allowed; }
      progress { width: 100%; height: 1rem; }
      .error { color: #9b0000; }
      .success { color: #006400; }
      .muted { color: #666; }
      .small { font-size: 0.85rem; }
    `,
  ],
})
export class FileUploaderComponent implements OnDestroy {
  // ---- Inputs (callable / config) ----
  signedUrl = input<string | null>(null);
  getSignedUrl = input<SignedUrlProvider | null>(null);
  uploadFn = input<UploadFunction | null>(null);
  awsConfig = input<AwsConfig | null>(null); // included for consumer use
  accept = input<string | null>(null);
  multiple = input<boolean>(false);
  maxSizeBytes = input<number | null>(null); // optional limit

  // ---- Outputs ----
  uploadComplete = output<UploadResult>();
  uploadProgress = output<number>(); // percent 0..100

  // ---- Internal state (signals) ----
  private _selectedFile = signal<File | null>(null);
  private _progress = signal<number>(0);
  private _isUploading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _lastResult = signal<UploadResult | null>(null);
  private abortController: AbortController | null = null;

  // DOM ref
  @ViewChild('fileInput', { static: true, read: ElementRef })
  private fileInputRef?: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);

  // derived
  selectedFileName = computed(() => this._selectedFile() ? this._selectedFile()!.name : '');
  selectedFileSizeText = computed(() => {
    const f = this._selectedFile();
    if (!f) return '';
    const kb = Math.round((f.size / 1024) * 10) / 10;
    return `${kb} KB`;
  });
  previewSrc = computed(() => {
    const f = this._selectedFile();
    if (!f) return null;
    if (f.type.startsWith('image/')) {
      return URL.createObjectURL(f);
    }
    return null;
  });
  canUpload = computed(() => {
    if (this._isUploading()) return false;
    const file = this._selectedFile();
    if (!file) return false;
    if (this.maxSizeBytes() && file.size > this.maxSizeBytes()!) return false;
    return true;
  });

  // small helpers for template binding
  fileInputId = `file-uploader-${Math.random().toString(36).slice(2, 9)}`;
  isUploading = () => this._isUploading();
  progress = () => Math.round(this._progress());
  error = () => this._error();
  lastResult = () => this._lastResult();

  constructor() {}

  // ---- Lifecycle ----
  ngOnDestroy(): void {
    // revoke object URLs
    const preview = this.previewSrc();
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch {}
    }
    this.cancelUpload();
  }

  // ---- Interaction handlers ----
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    // if multiple not allowed, take first
    const file = this.multiple() ? files[0] : files[0];
    this.setSelectedFile(file);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.clearDragStyles();
    const dt = ev.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;
    const file = dt.files[0];
    this.setSelectedFile(file);
  }
  onDragOver(ev: DragEvent): void { ev.preventDefault(); }
  onDragLeave(ev: DragEvent): void { this.clearDragStyles(); }
  private clearDragStyles() { /* optionally handle visuals */ }

  // ---- Public actions ----
  setSelectedFile(file: File): void {
    this._error.set(null);
    if (this.maxSizeBytes() && file.size > this.maxSizeBytes()!) {
      this._error.set(`File exceeds maximum size of ${this.maxSizeBytes()} bytes.`);
      this._selectedFile.set(null);
      this.cdr.markForCheck();
      return;
    }
    this._selectedFile.set(file);
    this._progress.set(0);
    this._lastResult.set(null);
    this.cdr.markForCheck();
  }

  clear(): void {
    // clear input value
    try {
      const el = this.fileInputRef?.nativeElement;
      if (el) el.value = '';
    } catch {}
    // revoke preview
    const preview = this.previewSrc();
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch {}
    }

    this._selectedFile.set(null);
    this._progress.set(0);
    this._error.set(null);
    this._lastResult.set(null);
    this.cdr.markForCheck();
  }

  async startUpload(): Promise<void> {
    this._error.set(null);
    const file = this._selectedFile();
    if (!file) {
      this._error.set('No file selected.');
      this.cdr.markForCheck();
      return;
    }

    this._isUploading.set(true);
    this._progress.set(0);
    this.abortController = new AbortController();

    try {
      // 1) Signed URL: prefer direct string prop, else call provider
      let signedUrl: string | null = this.signedUrl() ?? null;
      if (!signedUrl && this.getSignedUrl()) {
        signedUrl = await this.getSignedUrl()!(file);
      }
      if (!signedUrl) {
        throw new Error('No signed URL provided or returned by provider.');
      }

      // 2) Delegate upload to custom uploadFn if provided
      const custom = this.uploadFn();
      let result: UploadResult;
      if (custom) {
        result = await custom({
          file,
          signedUrl,
          onProgress: (p) => {
            this._progress.set(Math.round(p));
            this.uploadProgress.emit(Math.round(p));
            this.cdr.markForCheck();
          },
          abortSignal: this.abortController.signal,
        });
      } else {
        // default: upload with XHR to observe progress and support abort
        result = await this.uploadWithXhr(signedUrl, file, this.abortController.signal, (p) => {
          this._progress.set(Math.round(p));
          this.uploadProgress.emit(Math.round(p));
          this.cdr.markForCheck();
        });
      }

      this._lastResult.set(result);
      this.uploadComplete.emit(result);
      if (!result.success) {
        this._error.set(result.error ?? 'Upload failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this._error.set(message);
      this._lastResult.set({ success: false, status: null, error: message });
      this.uploadComplete.emit(this._lastResult()!);
    } finally {
      this._isUploading.set(false);
      this.abortController = null;
      this._progress.set(0);
      this.cdr.markForCheck();
    }
  }

  cancelUpload(): void {
    if (this.abortController) {
      try { this.abortController.abort(); } catch {}
      this._error.set('Upload cancelled.');
      this._isUploading.set(false);
      this._progress.set(0);
      this.cdr.markForCheck();
    }
  }

  // ---- Default XHR uploader (works for S3 signed PUT URLs) ----
  private uploadWithXhr(
    url: string,
    file: File,
    abortSignal: AbortSignal | null,
    onProgress?: (percent: number) => void
  ): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      // NOTE: With S3 presigned PUT URLs you should NOT set Content-Type if the URL already enforces it,
      // but often you need to set it. We set it explicitly from the file type.
      try { xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); } catch {}
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const percent = Math.round((ev.loaded / ev.total) * 100);
          onProgress?.(percent);
        }
      };
      xhr.onload = () => {
        const success = xhr.status >= 200 && xhr.status < 300;
        const locationHeader = xhr.getResponseHeader('Location') ?? undefined;
        let resp: unknown = undefined;
        try { resp = xhr.responseText ? JSON.parse(xhr.responseText) : undefined; } catch { resp = xhr.responseText || undefined; }
        resolve({
          success,
          status: xhr.status,
          location: locationHeader,
          response: resp,
          error: success ? undefined : `Upload failed with status ${xhr.status}`,
        });
      };
      xhr.onerror = () => {
        resolve({ success: false, status: xhr.status || null, error: 'Network error during upload' });
      };
      // hook up abort
      if (abortSignal) {
        if (abortSignal.aborted) {
          xhr.abort();
          resolve({ success: false, status: null, error: 'Upload aborted' });
          return;
        }
        const onAbort = () => {
          try { xhr.abort(); } catch {}
          resolve({ success: false, status: null, error: 'Upload aborted' });
          abortSignal.removeEventListener('abort', onAbort);
        };
        abortSignal.addEventListener('abort', onAbort);
      }

      xhr.send(file);
    });
  }
}
