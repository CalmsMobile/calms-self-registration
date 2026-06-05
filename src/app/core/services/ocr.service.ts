import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OcrData {
  document_type: string | null;
  country: string | null;
  full_name: string | null;
  id_number: string | null;
  document_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  address: {
    full: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  expiry_date: string | null;
}

export interface OcrResult {
  data: OcrData | null;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.proURL}app/api/Common/GetScanImageDetails`;

  async extractFromDataUrl(dataUrl: string): Promise<OcrResult> {
    const base64 = dataUrl.split(',')[1];
    const response: any = await firstValueFrom(
      this.http.post(this.apiUrl, { imgBase64: base64 })
    );
    return { data: response?.Data ?? null };
  }
}
