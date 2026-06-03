import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MessageHelperService } from './message-helper.service';

export interface UploadResult {
  fileName: string;
  filePath: string;
  fileUrl?: string;
  [key: string]: any;
}

export interface UploadValidationError {
  type: 'size' | 'format';
  message: string;
}

// BMP excluded — server rejects it ("Magic bytes do not match any supported image format")
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg', 'image/jpg', 'image/png'
];

const MAX_IMAGE_SIZE_MB = 5;
const MAX_DOCUMENT_SIZE_MB = 10;

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly commonBaseUrl: string;

  constructor(private http: HttpClient, private messageHelper: MessageHelperService) {
    // apiURL ends in /vims or /Vims; replace with /Common to reach the Common controller
    this.commonBaseUrl = environment.apiURL.replace(/\/vims$/i, '/Common');
  }

  validateImage(file: File): UploadValidationError | null {
    if (!IMAGE_TYPES.includes(file.type)) {
      return { type: 'format', message: `Invalid file type. Allowed: JPG, PNG, GIF, WebP` };
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      return { type: 'size', message: `Image must be under ${MAX_IMAGE_SIZE_MB}MB` };
    }
    return null;
  }

  validateDocument(file: File): UploadValidationError | null {
    if (!DOCUMENT_TYPES.includes(file.type)) {
      return { type: 'format', message: `Invalid file type. Allowed: PDF, Word, Excel, TXT, JPG, PNG` };
    }
    if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
      return { type: 'size', message: `Document must be under ${MAX_DOCUMENT_SIZE_MB}MB` };
    }
    return null;
  }

  /**
   * Validates the image server-side via POST /api/Common/UploadImage (form-data, key: "file").
   * Response: [{ Status: bool, Data: null, ErrorLog: [...] }]
   * Status=true  → file is valid, proceed
   * Status=false → throws; caller shows the appropriate error message
   */
  uploadImage(file: File, params?: Record<string, string>): Observable<UploadResult> {
    const validationError = this.validateImage(file);
    if (validationError) {
      this.messageHelper.error(validationError.message, 5000);
      return throwError(() => new Error(validationError.message));
    }

    const formData = new FormData();
    formData.append('file', file, file.name);
    if (params) {
      Object.entries(params).forEach(([key, val]) => formData.append(key, val));
    }

    return this.http.post<any>(`${this.commonBaseUrl}/UploadImage`, formData).pipe(
      map(res => this.extractResult(res)),
      catchError(err => this.handleHttpError(err))
    );
  }

  uploadDocument(file: File, params?: Record<string, string>): Observable<UploadResult> {
    const validationError = this.validateDocument(file);
    if (validationError) {
      this.messageHelper.error(validationError.message, 5000);
      return throwError(() => new Error(validationError.message));
    }

    const formData = new FormData();
    formData.append('file', file, file.name);
    if (params) {
      Object.entries(params).forEach(([key, val]) => formData.append(key, val));
    }

    return this.http.post<any>(`${this.commonBaseUrl}/UploadDocument`, formData).pipe(
      map(res => this.extractResult(res)),
      catchError(err => this.handleHttpError(err))
    );
  }

  private extractResult(response: any): UploadResult {
    // API returns: [{ Status: bool, Data: null|object, ErrorLog: [{ErrorDetail, Error}] }]
    const raw = Array.isArray(response) ? response[0] : response;
    if (!raw?.Status) {
      // Use ErrorDetail (specific) over Error (generic "contact admin" message)
      const serverMsg = raw?.ErrorLog?.[0]?.ErrorDetail
        || raw?.ErrorLog?.[0]?.Error
        || 'Upload validation failed';
      // No toast here — caller shows the component-level error message
      throw new Error(serverMsg);
    }
    // Data is null when API only validates without storing
    const data = raw.Data || {};
    return {
      fileName: data.FileName || data.fileName || '',
      filePath: data.FilePath || data.filePath || '',
      fileUrl:  data.FileUrl  || data.fileUrl  || '',
      ...data
    };
  }

  private handleHttpError(error: HttpErrorResponse): Observable<never> {
    const msg = error.status
      ? `Upload failed (${error.status}): ${error.statusText}`
      : 'Upload failed: network error';
    this.messageHelper.error(msg, 5000);
    return throwError(() => error);
  }
}
