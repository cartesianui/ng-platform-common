import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AppConfig, ObjectUtils } from '@cartesianui/core';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private http = inject(HttpClient);

  /**
   * Export data from an API endpoint with current criteria params.
   * Appends `output=csv|xlsx` to the existing query params, downloads as blob.
   *
   * @param endpoint - API path (e.g. '/products', '/sales-orders')
   * @param params - Current HttpParams from criteria
   * @param format - Export format: 'csv' or 'xlsx'
   * @param filename - Optional filename (auto-generated if omitted)
   */
  /**
   * @param endpoint - API path (e.g. '/products')
   * @param params - Current HttpParams from criteria
   * @param format - 'csv' or 'xlsx'
   * @param columns - Optional: columns to include (e.g. ['name', 'status', 'barcode'])
   * @param filename - Optional filename
   */
  export(endpoint: string, params: HttpParams, format: ExportFormat = 'csv', columns?: string[], filename?: string): void {
    params = params.set('output', format);
    if (columns?.length) {
      const needsConvert = AppConfig.keysFormatAPI && AppConfig.keysFormatAPP && AppConfig.keysFormatAPI !== AppConfig.keysFormatAPP;
      const converted = needsConvert
        ? columns.map(col => col.split('.').map(part => ObjectUtils.convertKey(part, AppConfig.keysFormatAPP, AppConfig.keysFormatAPI)).join('.'))
        : columns;
      params = params.set('filter', converted.join(';'));
    }

    const url = `${AppConfig.remoteServiceBaseUrl}${endpoint}`;

    this.http.get(url, { params, responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) return;

        // Try to get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const serverFilename = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]?.replace(/['"]/g, '');

        const downloadName = filename || serverFilename || `export-${Date.now()}.${format}`;

        // Trigger browser download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      error: (err) => {
        console.error('[ExportService] Export failed:', err);
      }
    });
  }
}
